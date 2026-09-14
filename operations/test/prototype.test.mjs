import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { PROBE_URL, probeWorkload, signatureWorkload, databaseWorkload } from '../prototype/worker.mjs';
import { signatureFixture } from '../scripts/prototype-fixtures.mjs';
import { retentionStatements, CLEANUP_BATCH_SIZE } from '../src/retention.mjs';

test('prototype has no public or management endpoint and is disabled by default', async () => {
  for (const path of ['/', '/v1/services/portfolio', '/owner/incidents']) {
    const response = await worker.fetch(new Request(`https://example.invalid${path}`));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  await assert.rejects(() => worker.scheduled({ scheduledTime: 0 }, {}), /not configured/);
});

test('probe issues one allowlisted GET, never follows redirects, and stops measuring at headers', async () => {
  let tick = 0;
  let cancelled = false;
  const result = await probeWorkload({
    clock: () => tick++ * 125,
    fetchImpl: async (url, init) => {
      assert.equal(url, PROBE_URL);
      assert.equal(init.method, 'GET');
      assert.equal(init.redirect, 'manual');
      return { status: 302, body: { cancel: async () => { cancelled = true; } } };
    },
  });
  assert.deepEqual(result, { outcome: 'redirect_error', httpStatus: 302, durationMs: 125 });
  assert.equal(cancelled, true);
});

test('body disposal failure does not replace a measured header response', async () => {
  const result = await probeWorkload({ fetchImpl: async () => ({ status: 204, body: { cancel: async () => { throw new Error('cancel failed'); } } }) });
  assert.equal(result.outcome, 'success');
});

test('body disposal cannot stall a completed header measurement', async () => {
  const result = await probeWorkload({ fetchImpl: async () => ({ status: 200, body: { cancel: () => new Promise(() => {}) } }) });
  assert.equal(result.outcome, 'success');
});

test('timeout and transport errors are distinct from HTTP failures', async () => {
  const timeout = await probeWorkload({ timeoutMs: 1, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) });
  assert.equal(timeout.outcome, 'timeout');
  assert.equal(timeout.httpStatus, null);
  const network = await probeWorkload({ fetchImpl: async () => { throw new Error('private transport details'); } });
  assert.equal(network.outcome, 'network_error');
  assert.equal(JSON.stringify(network).includes('private'), false);
  const http = await probeWorkload({ fetchImpl: async () => new Response(null, { status: 503 }) });
  assert.equal(http.outcome, 'http_error');
  assert.equal(http.httpStatus, 503);
});

test('signature workload verifies signature, issuer, audience, owner and expiry', async () => {
  const fixture = await signatureFixture(1800000000000);
  assert.equal(await signatureWorkload(fixture), true);
  for (const override of [{ issuer: 'wrong' }, { audience: 'wrong' }, { ownerSubject: 'wrong' }, { nowMs: fixture.nowMs + 600000 }]) {
    await assert.rejects(() => signatureWorkload({ ...fixture, ...override }));
  }
  const parts = fixture.token.split('.');
  const signature = Buffer.from(parts[2], 'base64url');
  signature[0] ^= 1;
  await assert.rejects(() => signatureWorkload({ ...fixture, token: `${parts[0]}.${parts[1]}.${signature.toString('base64url')}` }), /signature/);
});

test('opt-in prototype auth route measures valid and denied requests without exposing owner data', async () => {
  const fixture = await signatureFixture(Date.now());
  const env = { PROTOTYPE_ONLY: 'true', PROTOTYPE_PUBLIC_JWK: JSON.stringify(fixture.publicJwk),
    PROTOTYPE_ISSUER: fixture.issuer, PROTOTYPE_AUDIENCE: fixture.audience, PROTOTYPE_SUBJECT: fixture.ownerSubject };
  const denied = await worker.fetch(new Request('https://example.invalid/prototype/auth'), env);
  assert.equal(denied.status, 401);
  const allowed = await worker.fetch(new Request('https://example.invalid/prototype/auth', { headers: { 'Cf-Access-Jwt-Assertion': fixture.token } }), env);
  assert.equal(allowed.status, 200);
  assert.equal(allowed.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await allowed.json(), { workload: 'prototype-auth', verified: true });
  const management = await worker.fetch(new Request('https://example.invalid/owner/incidents', { method: 'POST' }), env);
  assert.equal(management.status, 503);
});

test('D1 workload uses bounded prepared statements and never overwrites the primary', async () => {
  const statements = [];
  const db = {
    prepare(sql) { return { bind(...bindings) { const statement = { sql, bindings }; statements.push(statement); return statement; } }; },
    async batch(items) { assert.deepEqual(items, statements); return items.map(() => ({ meta: { rows_read: 1, rows_written: 1 } })); },
  };
  await databaseWorkload(db, { slot: 300000, observedAt: 300100, primary: { outcome: 'http_error', httpStatus: 503, durationMs: 100 }, confirmation: { outcome: 'success' } });
  assert.equal(statements.length, 3);
  assert.match(statements[0].sql, /ON CONFLICT\(slot\) DO NOTHING/);
  assert.equal(statements[0].bindings[2], 'http_error');
  assert.match(statements[2].sql, /LIMIT 100/);
  await assert.rejects(() => databaseWorkload(db, { slot: 1, observedAt: 2, primary: {} }), /Invalid slot/);
});

test('scheduled probes persist the scheduled five-minute slot despite timer jitter and delayed delivery', async (t) => {
  const slot = Date.UTC(2026, 8, 13, 2, 30);
  const observedAt = slot + 600000;
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 200 }));
  t.mock.method(Date, 'now', () => observedAt);
  t.mock.method(console, 'log', () => {});
  const batches = [];
  const db = {
    prepare(sql) { return { bind(...bindings) { return { sql, bindings }; } }; },
    async batch(statements) { batches.push(statements); return statements.map(() => ({ meta: {} })); },
  };
  for (const offset of [0, 25000, 299999]) {
    await worker.scheduled({ scheduledTime: slot + offset }, { PROTOTYPE_ONLY: 'true', PROTOTYPE_DB: db });
  }
  assert.equal(fetchMock.mock.callCount(), 3);
  assert.equal(batches.length, 3);
  for (const statements of batches) {
    assert.equal(statements[0].bindings[0], slot);
    assert.equal(statements[0].bindings[1], observedAt);
    assert.equal(statements[0].bindings[2], 'success');
  }
});

test('invalid scheduler timestamps are rejected before probing or writing', async (t) => {
  const fetchMock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 200 }));
  for (const scheduledTime of [-1, NaN, Infinity, undefined, '300000', 300000.5]) {
    await assert.rejects(() => worker.scheduled({ scheduledTime }, {
      PROTOTYPE_ONLY: 'true', PROTOTYPE_DB: {},
    }), /Invalid scheduled time/);
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('retention statements bind a fixed small batch and reject invalid clocks', () => {
  for (const statement of retentionStatements(1800000000000)) {
    assert.equal(statement.bindings.at(-1), CLEANUP_BATCH_SIZE);
    assert.match(statement.sql, /LIMIT \?/);
  }
  assert.throws(() => retentionStatements(NaN));
});
