import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ContractError,
  SERVICE_TARGET,
  buildPublicErrorEnvelope,
  buildPublicStatusEnvelope,
  parsePublicRequest,
  parsePublicWindow,
  publicWindowRange,
  resolveServiceTarget,
} from '../src/contracts.mjs';

test('only the portfolio identifier resolves to the exact configured target', () => {
  assert.equal(resolveServiceTarget('portfolio'), SERVICE_TARGET);
  for (const invalid of ['', 'https://waffy.dev/', 'portfolio?url=https://example.test', 'PORTFOLIO']) {
    assert.throws(() => resolveServiceTarget(invalid), ContractError);
  }
});

test('public request parsing rejects absent, unknown, duplicate, and invalid parameters', () => {
  assert.deepEqual(parsePublicRequest(new URLSearchParams('service=portfolio&window=7d')), {
    serviceId: 'portfolio', window: '7d',
  });
  assert.deepEqual(parsePublicRequest(new URLSearchParams('service=portfolio')), {
    serviceId: 'portfolio', window: '24h',
  });
  for (const query of [
    '',
    'service=portfolio&window=8d',
    'service=portfolio&service=portfolio',
    'service=portfolio&window=24h&window=7d',
    'service=portfolio&target=https%3A%2F%2Fexample.test',
  ]) {
    assert.throws(() => parsePublicRequest(new URLSearchParams(query)), ContractError);
  }
  assert.throws(() => parsePublicWindow('24H'), ContractError);
});

test('public ranges are UTC epoch windows with an exact endpoint', () => {
  const nowMs = Date.UTC(2026, 8, 10, 12, 0, 0);
  assert.deepEqual(publicWindowRange('24h', nowMs), {
    key: '24h', startMs: nowMs - 86_400_000, endMs: nowMs,
  });
  assert.throws(() => publicWindowRange('30d', -1), ContractError);
  assert.throws(() => publicWindowRange('24h', 8_640_000_000_000_001), ContractError);
});

test('public serialization whitelists summary fields and omits private data', () => {
  const nowMs = Date.UTC(2026, 8, 10, 12, 0, 0);
  const response = buildPublicStatusEnvelope({
    serviceId: 'portfolio',
    nowMs,
    status: {
      state: 'operational', reason: 'fresh_success', lastObservationAtMs: nowMs - 500,
      observationAgeMs: 500, lastLatencyMs: 42.5, slowMs: 2_000, hasGapWarning: false,
      ownerEmail: 'owner@example.test', errorMessage: 'private failure', token: 'secret',
    },
    availability: {
      window: { key: '24h', startMs: nowMs - 86_400_000, endMs: nowMs },
      successfulPrimary: 10, completedPrimary: 11, expectedPrimary: 12, missingPrimary: 1,
      availabilityPercent: 90.909, coveragePercent: 91.667,
      gaps: { hasGaps: true, lastMissingSlotAtMs: nowMs - 300_000 },
      responseBody: '<html>private</html>', configuration: { target: 'https://internal.test/' },
    },
  });

  assert.deepEqual(Object.keys(response).sort(), ['generatedAt', 'history', 'service', 'status']);
  assert.equal(response.service.id, 'portfolio');
  assert.equal(response.status.lastObservationAt, new Date(nowMs - 500).toISOString());
  assert.equal(response.status.latencyMs, 42.5);
  assert.equal(response.status.slowThresholdMs, 2_000);
  assert.equal(JSON.stringify(response).includes('secret'), false);
  assert.equal(JSON.stringify(response).includes('owner@example.test'), false);
  assert.equal(JSON.stringify(response).includes('private failure'), false);
  assert.equal(JSON.stringify(response).includes('internal.test'), false);
  assert.deepEqual(buildPublicErrorEnvelope('invalid_request'), { error: { code: 'invalid_request' } });
  assert.deepEqual(buildPublicErrorEnvelope('private error text'), { error: { code: 'internal_error' } });
  assert.throws(() => buildPublicStatusEnvelope({
    serviceId: 'portfolio', nowMs, status: { state: 'trusted', reason: 'injected' }, availability: {
      window: { key: '24h', startMs: nowMs - 1, endMs: nowMs },
    },
  }), ContractError);
});
