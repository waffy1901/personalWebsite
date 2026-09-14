import assert from 'node:assert/strict';
import test from 'node:test';

import runner, { validateRunnerConfig } from '../prototype/feasibility-runner.mjs';
import worker, {
  BENCHMARK_BASE_SLOT_MS,
  authWorkload,
  collectorFailureWorkload,
  materializedSummaryCacheWorkload,
  metricWorkload,
  ownerIncidentAuditWorkload,
  publicJwksImportWorkload,
  schemaBatchWorkload,
  validateBenchmarkConfig,
} from '../prototype/feasibility-worker.mjs';
import { createFeasibilityFixtures } from '../scripts/feasibility-fixtures.mjs';

const FIXTURE_NOW_MS = 1_800_000_000_000;
const fixturesPromise = createFeasibilityFixtures(FIXTURE_NOW_MS);

async function enabledEnv(overrides = {}) {
  return {
    PROTOTYPE_ONLY: 'true',
    BENCHMARK_UNTIL_MS: String(Date.now() + 60 * 60 * 1000),
    BENCHMARK_FIXTURES: JSON.stringify(await fixturesPromise),
    ...overrides,
  };
}

function request(caseName, sequence = 0) {
  return new Request(`https://benchmark.invalid/v1/${caseName}`, {
    method: 'POST', headers: { 'X-Benchmark-Sequence': String(sequence) },
  });
}

function statementDb(batchResults) {
  const statements = [];
  return {
    statements,
    db: {
      prepare(sql) {
        return {
          bind(...bindings) {
            const statement = { sql, bindings };
            statements.push(statement);
            return statement;
          },
          async run() {
            statements.push({ sql, bindings: [] });
            return batchResults?.[0] ?? { results: [], meta: {} };
          },
        };
      },
      async batch(items) {
        assert.deepEqual(items, statements);
        return batchResults ?? items.map(() => ({ results: [], meta: { rows_read: 0, rows_written: 1 } }));
      },
    },
  };
}

test('fixture export contains two public JWKs and no RSA private parameters', async () => {
  const fixtures = await fixturesPromise;
  assert.equal(fixtures.nowMs, FIXTURE_NOW_MS);
  assert.equal(fixtures.jwks.keys.length, 2);
  const serialized = JSON.stringify(fixtures);
  for (const field of ['"d":', '"p":', '"q":', '"dp":', '"dq":', '"qi":']) {
    assert.equal(serialized.includes(field), false);
  }
  await assert.rejects(() => createFeasibilityFixtures(), /nowMs/);
});

test('all worker effects are behind exact route, method, host, expiration, and fixture gates', async () => {
  let databaseCalls = 0;
  const db = { prepare() { databaseCalls += 1; throw new Error('must not run'); } };
  const env = await enabledEnv({ SCHEMA_DB: db });
  const denied = [
    worker.fetch(request('schema_batch'), { ...env, PROTOTYPE_ONLY: 'false' }),
    worker.fetch(request('schema_batch'), { ...env, BENCHMARK_UNTIL_MS: String(Date.now() - 1) }),
    worker.fetch(request('schema_batch'), { ...env, BENCHMARK_FIXTURES: '{' }),
    worker.fetch(new Request('https://example.invalid/v1/schema_batch', { method: 'POST' }), env),
    worker.fetch(new Request('https://benchmark.invalid/v1/schema_batch'), env),
    worker.fetch(request('not-a-case'), env),
  ];
  for (const pending of denied) assert.equal((await pending).status, 503);
  assert.equal(databaseCalls, 0);
});

test('synthetic auth measures import, claim denial, signature denial, and supplied-JWK rotation lookup', async () => {
  const config = validateBenchmarkConfig(await enabledEnv());
  assert.deepEqual(await authWorkload('auth_import', config), { verified: true, verifier: 'supplied-JWK' });
  assert.equal((await authWorkload('auth_denied_claim', config)).denied, true);
  assert.equal((await authWorkload('auth_denied_signature', config)).denied, true);
  const rotation = await authWorkload('auth_lookup_rotation', config);
  assert.deepEqual(rotation, {
    verifier: 'supplied-JWK', simulatedRotation: true,
    initialLookup: 'miss', rotatedLookup: 'hit', verified: true,
  });
});

test('collector failure and real AbortController timeout make exactly one confirmation attempt', async () => {
  let httpCalls = 0;
  const http = await collectorFailureWorkload({ fetchImpl: async () => {
    httpCalls += 1;
    return new Response(null, { status: 503 });
  } });
  assert.deepEqual([http.primary.outcome, http.confirmation.outcome, http.attempts], ['http_error', 'http_error', 2]);
  assert.equal(httpCalls, 2);

  let timeoutCalls = 0;
  const timeout = await collectorFailureWorkload({
    timeoutMs: 1,
    fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
      timeoutCalls += 1;
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  });
  assert.deepEqual([timeout.primary.outcome, timeout.confirmation.outcome, timeout.attempts], ['timeout', 'timeout', 2]);
  assert.equal(timeoutCalls, 2);
  assert.equal(timeout.outboundRequests, 0);
});

test('public JWKS import accepts only the exact Cloudflare Access cert route and bounds key count', async () => {
  const fixtures = await fixturesPromise;
  let requested;
  const result = await publicJwksImportWorkload(
    'https://fixture-team.cloudflareaccess.com/cdn-cgi/access/certs',
    { fetchImpl: async (url, options) => {
      assert.equal(options.redirect, 'manual');
      requested = url;
      return Response.json({ keys: fixtures.jwks.keys });
    } },
  );
  assert.equal(requested, 'https://fixture-team.cloudflareaccess.com/cdn-cgi/access/certs');
  assert.equal(result.importedKeys, 2);
  let redirectCalls = 0;
  await assert.rejects(() => publicJwksImportWorkload(
    'https://fixture-team.cloudflareaccess.com/cdn-cgi/access/certs',
    { fetchImpl: async (_url, options) => {
      redirectCalls += 1;
      assert.equal(options.redirect, 'manual');
      return new Response(null, { status: 302, headers: { Location: 'https://example.com/' } });
    } },
  ), (error) => error.stage === 'http_response');
  assert.equal(redirectCalls, 1);
  await assert.rejects(() => publicJwksImportWorkload(
    'https://fixture-team.cloudflareaccess.com/cdn-cgi/access/certs',
    { fetchImpl: async () => { throw new Error('private provider detail'); } },
  ), (error) => error.stage === 'fetch' && !error.message.includes('private provider detail'));
  await assert.rejects(() => publicJwksImportWorkload(
    'https://example.com/cdn-cgi/access/certs', { fetchImpl: async () => { throw new Error('effect'); } },
  ), /allowlisted/);
});

test('existing metric functions run at all requested cardinalities and return only aggregate counts', () => {
  for (const count of [288, 2016, 8640]) {
    const result = metricWorkload(count, FIXTURE_NOW_MS);
    assert.equal(result.inputObservations, count);
    assert.equal(result.expectedPrimary, count);
    assert.equal(result.completedPrimary, count);
    assert.equal(result.availabilityPercent, 100);
    assert.equal(Object.hasOwn(result, 'observations'), false);
  }
});

test('full-schema batch is fixed at seven statements in the isolated slot range and reports D1 meta', async () => {
  const { db, statements } = statementDb();
  const result = await schemaBatchWorkload(db, 3);
  assert.equal(statements.length, 7);
  assert.equal(statements.some(({ sql }) => /DELETE|retention/i.test(sql)), false);
  assert.equal(result.slotMs, BENCHMARK_BASE_SLOT_MS + 3 * 300_000);
  assert.equal(result.d1.rowsWritten, 7);
  assert.equal(statements[0].bindings[1], result.slotMs);
});

test('materialized summary cache observes miss then hit and bounds D1 to one fixed read', async () => {
  const cached = new Map();
  const cache = {
    async match(requestValue) { return cached.get(requestValue.url)?.clone(); },
    async put(requestValue, response) { cached.set(requestValue.url, response.clone()); },
  };
  const { db, statements } = statementDb([{
    results: [{ window: '24h', generated_at_ms: 100, latest_observed_at_ms: 90, payload_json: '{"fixture":true}' }],
    meta: { rows_read: 1, rows_written: 0 },
  }]);
  const first = await materializedSummaryCacheWorkload(db, cache);
  assert.deepEqual([first.initialCache, first.confirmedCache, first.d1.rowsRead], ['miss', 'hit', 1]);
  assert.equal(statements.length, 1);
  assert.equal(cached.size, 1);
  assert.equal([...cached.keys()][0], 'https://benchmark.invalid/cache/deployment-feasibility-v2/run-feasibility-v2/summary/24h');
  const second = await materializedSummaryCacheWorkload(db, cache);
  assert.deepEqual([second.initialCache, second.confirmedCache, second.d1.rowsRead], ['hit', 'hit', 0]);
  assert.equal(statements.length, 1);
});

test('owner incident and audit workload performs two bounded writes and two fixed reads without owner data', async () => {
  const results = [
    { results: [], meta: { rows_read: 0, rows_written: 1 } },
    { results: [], meta: { rows_read: 0, rows_written: 1 } },
    { results: [{ id: 'internal' }], meta: { rows_read: 1, rows_written: 0 } },
    { results: [{ id: 'internal' }], meta: { rows_read: 1, rows_written: 0 } },
  ];
  const { db, statements } = statementDb(results);
  const result = await ownerIncidentAuditWorkload(db, 4);
  assert.deepEqual(result, {
    incidentFound: true, auditFound: true,
    d1: { statements: results.map((item) => ({ rowsRead: item.meta.rows_read, rowsWritten: item.meta.rows_written })), rowsRead: 2, rowsWritten: 2 },
  });
  assert.equal(statements.length, 4);
  assert.equal(JSON.stringify(result).includes('synthetic-owner'), false);
});

test('runner rejects malformed or out-of-window schedules before any service call', async () => {
  let calls = 0;
  const nowMs = Date.UTC(2026, 8, 13, 12, 0);
  const scheduledTime = nowMs + 60_000;
  const env = await enabledEnv({
    BENCHMARK_UNTIL_MS: String(nowMs + 2 * 60 * 60 * 1000),
    BENCHMARK_CASES: '["auth_import"]',
    BENCHMARK_REPETITIONS: '1',
    BENCHMARK_SCHEDULE_DATE: '2026-09-13',
    BENCHMARK_MINUTE_RANGE: '721-721',
    BENCHMARK_SERVICE: { async fetch() { calls += 1; return Response.json({}); } },
  });
  assert.equal(validateRunnerConfig(env, scheduledTime, nowMs).callCount, 1);
  for (const override of [
    { PROTOTYPE_ONLY: 'false' },
    { BENCHMARK_CASES: '["unknown"]' },
    { BENCHMARK_REPETITIONS: '4' },
    { BENCHMARK_SCHEDULE_DATE: '2026-09-14' },
    { BENCHMARK_MINUTE_RANGE: '722-723' },
  ]) {
    await assert.rejects(() => runner.scheduled({ scheduledTime }, { ...env, ...override }));
  }
  assert.equal(calls, 0);
});

test('runner awaits service-binding requests sequentially and sanitizes each result log', async (t) => {
  const nowMs = Date.now();
  const scheduledTime = nowMs + 60_000;
  const scheduled = new Date(scheduledTime);
  const minute = scheduled.getUTCHours() * 60 + scheduled.getUTCMinutes();
  let active = 0;
  let maxActive = 0;
  let calls = 0;
  const logs = [];
  t.mock.method(console, 'log', (line) => logs.push(JSON.parse(line)));
  const env = await enabledEnv({
    BENCHMARK_UNTIL_MS: String(nowMs + 60 * 60 * 1000),
    BENCHMARK_CASES: '["auth_import","metrics_288"]',
    BENCHMARK_REPETITIONS: '2',
    BENCHMARK_SCHEDULE_DATE: scheduled.toISOString().slice(0, 10),
    BENCHMARK_MINUTE_RANGE: `${minute}-${minute}`,
    BENCHMARK_SERVICE: { async fetch() {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return Response.json({ result: { verified: true, token: 'must-not-log' } });
    } },
  });
  await runner.scheduled({ scheduledTime }, env);
  assert.equal(calls, 4);
  assert.equal(maxActive, 1);
  assert.equal(logs.length, 5);
  assert.equal(JSON.stringify(logs).includes('must-not-log'), false);
});

test('spread mode executes only the scheduled case and preserves its unique sequence', async (t) => {
  const nowMs = Date.UTC(2026, 8, 13, 12, 0);
  t.mock.method(Date, 'now', () => nowMs);
  t.mock.method(console, 'log', () => {});
  const calls = [];
  const env = await enabledEnv({
    BENCHMARK_CASES: '["schema_batch","summary_cache"]',
    BENCHMARK_REPETITIONS: '2',
    BENCHMARK_SCHEDULE_DATE: '2026-09-13',
    BENCHMARK_MINUTE_RANGE: '721-724',
    BENCHMARK_SPREAD_MINUTES: 'true',
    BENCHMARK_SERVICE: { async fetch(value) {
      calls.push([new URL(value.url).pathname, value.headers.get('X-Benchmark-Sequence')]);
      return Response.json({});
    } },
  });
  await runner.scheduled({ scheduledTime: nowMs + 3 * 60_000 }, env);
  assert.deepEqual(calls, [['/v1/schema_batch', '2']]);
  await assert.rejects(() => runner.scheduled(
    { scheduledTime: nowMs + 3 * 60_000 }, { ...env, BENCHMARK_MINUTE_RANGE: '721-725' },
  ), /range/);
  assert.equal(calls.length, 1);
});
