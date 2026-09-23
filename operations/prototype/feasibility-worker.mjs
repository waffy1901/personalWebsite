import { calculateAvailability, calculateStatus, SLOT_MS } from '../src/metrics.mjs';
import { probeWorkload, signatureWorkload } from './worker.mjs';

export const BENCHMARK_HOST = 'benchmark.invalid';
// Separate from the history fixture range ending at 570,149,700,000.
export const BENCHMARK_BASE_SLOT_MS = 750_000_000_000;
export const BENCHMARK_CASES = Object.freeze([
  'auth_import',
  'auth_denied_claim',
  'auth_denied_signature',
  'auth_lookup_rotation',
  'public_jwks_import',
  'collector_http_failure',
  'collector_timeout',
  'metrics_288',
  'metrics_2016',
  'metrics_8640',
  'schema_batch',
  'summary_cache',
  'owner_incident_audit',
]);

const CASE_SET = new Set(BENCHMARK_CASES);
const PRIVATE_JWK_FIELDS = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'];
const MAX_FIXTURE_BYTES = 64 * 1024;
const MAX_JWKS_BYTES = 64 * 1024;
const MAX_EXPIRY_HORIZON_MS = 6 * 60 * 60 * 1000;
const CACHE_KEY = `https://${BENCHMARK_HOST}/cache/deployment-feasibility-v2/run-feasibility-v2/summary/24h`;

class PublicJwksError extends Error {
  constructor(stage) {
    super('Public JWKS workload failed');
    this.stage = stage;
  }
}

// This counter is diagnostic only: it never carries request, auth, or owner state.
// Incrementing before the first await gives an isolate-local request ordinal, not a cold-start claim.
let isolateInvocationOrdinal = 0;

function fail(message) {
  throw new TypeError(message);
}

function isNonemptyString(value, maxLength = 256) {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function validatePublicJwk(jwk) {
  if (!jwk || typeof jwk !== 'object' || jwk.kty !== 'RSA' || jwk.alg !== 'RS256'
    || jwk.use !== 'sig' || !isNonemptyString(jwk.kid, 80)
    || !isNonemptyString(jwk.n, 4096) || !isNonemptyString(jwk.e, 16)
    || PRIVATE_JWK_FIELDS.some((field) => Object.hasOwn(jwk, field))) fail('Invalid public JWK fixture');
  return jwk;
}

function validateToken(value) {
  if (!isNonemptyString(value, 8192) || value.split('.').length !== 3) fail('Invalid token fixture');
  return value;
}

export function validateBenchmarkConfig(env, nowMs = Date.now()) {
  if (!env || env.PROTOTYPE_ONLY !== 'true') fail('Benchmark is disabled');
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) fail('Invalid benchmark clock');
  if (typeof env.BENCHMARK_UNTIL_MS !== 'string' || !/^\d{1,16}$/.test(env.BENCHMARK_UNTIL_MS)) {
    fail('Invalid benchmark expiration');
  }
  const untilMs = Number(env.BENCHMARK_UNTIL_MS);
  if (!Number.isSafeInteger(untilMs) || untilMs <= nowMs || untilMs > nowMs + MAX_EXPIRY_HORIZON_MS) {
    fail('Benchmark is expired or too long');
  }
  if (!isNonemptyString(env.BENCHMARK_FIXTURES, MAX_FIXTURE_BYTES)) fail('Missing benchmark fixtures');
  let fixtures;
  try {
    fixtures = JSON.parse(env.BENCHMARK_FIXTURES);
  } catch {
    fail('Invalid benchmark fixtures');
  }
  if (!fixtures || fixtures.version !== 1 || !Number.isSafeInteger(fixtures.nowMs) || fixtures.nowMs < 0
    || !isNonemptyString(fixtures.issuer) || !isNonemptyString(fixtures.audience)
    || !isNonemptyString(fixtures.ownerSubject) || !fixtures.jwks || !Array.isArray(fixtures.jwks.keys)
    || fixtures.jwks.keys.length !== 2 || !fixtures.tokens) fail('Invalid benchmark fixtures');
  const keys = fixtures.jwks.keys.map(validatePublicJwk);
  if (new Set(keys.map(({ kid }) => kid)).size !== 2) fail('Duplicate public JWK fixture');
  for (const name of ['valid', 'deniedClaim', 'deniedSignature', 'rotation']) validateToken(fixtures.tokens[name]);
  return { untilMs, fixtures: { ...fixtures, jwks: { keys } } };
}

function decodeJwtHeader(token) {
  const [encoded] = token.split('.');
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0))));
}

function suppliedJwkParams(config, token, publicJwk) {
  return {
    token,
    publicJwk,
    issuer: config.fixtures.issuer,
    audience: config.fixtures.audience,
    ownerSubject: config.fixtures.ownerSubject,
    nowMs: config.fixtures.nowMs,
  };
}

async function expectDenied(work) {
  try {
    await work();
  } catch {
    return { denied: true };
  }
  throw new Error('Synthetic denial unexpectedly passed');
}

export async function authWorkload(caseName, config) {
  const { fixtures } = config;
  const firstKey = fixtures.jwks.keys[0];
  if (caseName === 'auth_import') {
    await signatureWorkload(suppliedJwkParams(config, fixtures.tokens.valid, firstKey));
    return { verified: true, verifier: 'supplied-JWK' };
  }
  if (caseName === 'auth_denied_claim') {
    return { ...await expectDenied(() => signatureWorkload(suppliedJwkParams(
      config, fixtures.tokens.deniedClaim, firstKey,
    ))), verifier: 'supplied-JWK' };
  }
  if (caseName === 'auth_denied_signature') {
    return { ...await expectDenied(() => signatureWorkload(suppliedJwkParams(
      config, fixtures.tokens.deniedSignature, firstKey,
    ))), verifier: 'supplied-JWK' };
  }

  const rotationKid = decodeJwtHeader(fixtures.tokens.rotation).kid;
  const beforeRotation = fixtures.jwks.keys.slice(0, 1).find(({ kid }) => kid === rotationKid) ?? null;
  const rotatedKey = fixtures.jwks.keys.find(({ kid }) => kid === rotationKid);
  if (!rotatedKey) throw new Error('Synthetic rotation key is unavailable');
  await signatureWorkload(suppliedJwkParams(config, fixtures.tokens.rotation, rotatedKey));
  return {
    verifier: 'supplied-JWK',
    simulatedRotation: true,
    initialLookup: beforeRotation === null ? 'miss' : 'hit',
    rotatedLookup: 'hit',
    verified: true,
  };
}

function parsePublicJwksUrl(value) {
  if (!isNonemptyString(value, 512)) fail('Missing public JWKS URL');
  let url;
  try {
    url = new URL(value);
  } catch {
    fail('Invalid public JWKS URL');
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.search || url.hash
    || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.hostname)
    || url.pathname !== '/cdn-cgi/access/certs') fail('Public JWKS URL is not allowlisted');
  return url.href;
}

async function readBoundedJson(response, maxBytes) {
  const contentLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw new Error('Response is too large');
  if (!response.body) return {};
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error('Response is too large');
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function publicJwksImportWorkload(urlValue, { fetchImpl = fetch, timeoutMs = 5000 } = {}) {
  const url = parsePublicJwksUrl(urlValue);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let stage = 'fetch';
  try {
    const response = await fetchImpl(url, {
      method: 'GET', redirect: 'manual', signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'Waffy-Operations-Feasibility/1.0' },
    });
    stage = 'http_response';
    if (!response.ok) {
      if (response.body) await response.body.cancel();
      throw new Error('Public JWKS request failed');
    }
    stage = 'read_body';
    const payload = await readBoundedJson(response, MAX_JWKS_BYTES);
    stage = 'validate_keys';
    if (!payload || !Array.isArray(payload.keys) || payload.keys.length < 1 || payload.keys.length > 8) {
      throw new Error('Invalid public JWKS response');
    }
    let imported = 0;
    stage = 'import_keys';
    for (const jwk of payload.keys) {
      if (jwk?.kty !== 'RSA' || !isNonemptyString(jwk.n, 4096) || !isNonemptyString(jwk.e, 16)) continue;
      await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      imported += 1;
    }
    if (imported === 0) throw new Error('No supported public signing keys');
    return { source: 'cloudflare-public-certs', httpStatus: response.status, bytesRead: null, importedKeys: imported };
  } catch {
    throw new PublicJwksError(stage);
  } finally {
    clearTimeout(timer);
  }
}

export async function collectorFailureWorkload({
  fetchImpl = async () => new Response(null, { status: 503 }), timeoutMs = 10_000,
} = {}) {
  const primary = await probeWorkload({ fetchImpl, timeoutMs });
  const confirmation = primary.outcome === 'success' ? null : await probeWorkload({ fetchImpl, timeoutMs });
  return { primary, confirmation, attempts: confirmation ? 2 : 1, outboundRequests: 0 };
}

export function metricWorkload(count, fixtureNowMs) {
  if (![288, 2016, 8640].includes(count)) fail('Invalid metric count');
  const endMs = Math.floor(fixtureNowMs / SLOT_MS) * SLOT_MS;
  const startMs = endMs - count * SLOT_MS;
  const observations = Array.from({ length: count }, (_, index) => ({
    scheduledAtMs: startMs + index * SLOT_MS,
    completedAtMs: startMs + index * SLOT_MS + 10,
    outcome: 'success',
    latencyMs: 100,
    kind: 'primary',
  }));
  const enabledPeriods = [{ startMs, endMs: null }];
  const nowMs = endMs + 20_000;
  const availability = calculateAvailability({
    observations, enabledPeriods, nowMs, window: { key: 'synthetic', startMs, endMs },
  });
  const status = calculateStatus({ observations, enabledPeriods, nowMs });
  return {
    inputObservations: count,
    expectedPrimary: availability.expectedPrimary,
    completedPrimary: availability.completedPrimary,
    availabilityPercent: availability.availabilityPercent,
    coveragePercent: availability.coveragePercent,
    status: status.state,
    statusReason: status.reason,
  };
}

function d1Meta(result) {
  return {
    rowsRead: Number(result?.meta?.rows_read ?? 0),
    rowsWritten: Number(result?.meta?.rows_written ?? 0),
  };
}

function d1Results(results) {
  const statements = results.map(d1Meta);
  return {
    statements,
    rowsRead: statements.reduce((total, item) => total + item.rowsRead, 0),
    rowsWritten: statements.reduce((total, item) => total + item.rowsWritten, 0),
  };
}

function sequenceSlot(sequence) {
  if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence >= 40) fail('Invalid benchmark sequence');
  return BENCHMARK_BASE_SLOT_MS + sequence * SLOT_MS;
}

export async function schemaBatchWorkload(db, sequence) {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') fail('Missing SCHEMA_DB binding');
  const slot = sequenceSlot(sequence);
  const fixtureId = `feasibility-v2-${sequence}`;
  const payload = JSON.stringify({ fixture: true, slotMs: slot, state: 'degraded' });
  const statements = [
    db.prepare(`INSERT INTO collector_runs
      (id, service_id, config_version, scheduled_at_ms, started_at_ms, finished_at_ms, state, error_code)
      VALUES (?, 'portfolio', 1, ?, ?, ?, 'completed', NULL) ON CONFLICT(id) DO NOTHING`)
      .bind(`${fixtureId}-run`, slot, slot + 10, slot + 20_001),
    db.prepare(`INSERT INTO observations
      (service_id, scheduled_at_ms, config_version, run_id, observed_at_ms, outcome, http_status, duration_ms)
      VALUES ('portfolio', ?, 1, ?, ?, 'http_error', 503, 125) ON CONFLICT(service_id, scheduled_at_ms) DO NOTHING`)
      .bind(slot, `${fixtureId}-run`, slot + 125),
    db.prepare(`INSERT INTO confirmation_observations
      (service_id, scheduled_at_ms, observed_at_ms, outcome, http_status, duration_ms)
      VALUES ('portfolio', ?, ?, 'timeout', NULL, 10000) ON CONFLICT(service_id, scheduled_at_ms) DO NOTHING`)
      .bind(slot, slot + 20_000),
    db.prepare(`INSERT INTO service_state_checkpoints
      (service_id, active_period_start_ms, last_processed_slot_ms, established_down,
       failure_streak, recovery_streak, updated_at_ms)
      VALUES ('portfolio', 0, ?, 0, 1, 0, ?)
      ON CONFLICT(service_id) DO UPDATE SET active_period_start_ms = excluded.active_period_start_ms,
        last_processed_slot_ms = excluded.last_processed_slot_ms, established_down = excluded.established_down,
        failure_streak = excluded.failure_streak, recovery_streak = excluded.recovery_streak,
        updated_at_ms = excluded.updated_at_ms`).bind(slot, slot + 20_000),
    ...['24h', '7d', '30d'].map((window) => db.prepare(`INSERT INTO public_summaries
      (service_id, window, generated_at_ms, latest_observed_at_ms, payload_json)
      VALUES ('portfolio', ?, ?, ?, ?)
      ON CONFLICT(service_id, window) DO UPDATE SET generated_at_ms = excluded.generated_at_ms,
        latest_observed_at_ms = excluded.latest_observed_at_ms, payload_json = excluded.payload_json`)
      .bind(window, slot + 20_000, slot + 125, payload)),
  ];
  const results = await db.batch(statements);
  return { slotMs: slot, operations: 'run-primary-confirmation-checkpoint-three-summaries', d1: d1Results(results) };
}

export async function materializedSummaryCacheWorkload(db, cache) {
  if (!db || typeof db.prepare !== 'function' || !cache
    || typeof cache.match !== 'function' || typeof cache.put !== 'function') fail('Missing summary bindings');
  const key = new Request(CACHE_KEY);
  let response = await cache.match(key);
  const initialCache = response ? 'hit' : 'miss';
  let database = { statements: [], rowsRead: 0, rowsWritten: 0 };
  if (!response) {
    const result = await db.prepare(`SELECT window, generated_at_ms, latest_observed_at_ms, payload_json
      FROM public_summaries WHERE service_id = 'portfolio' AND window = '24h' LIMIT 1`).run();
    database = d1Results([result]);
    const row = result.results?.[0];
    if (!row) return { initialCache, confirmedCache: 'miss', summaryFound: false, d1: database };
    response = Response.json({
      window: row.window,
      generatedAtMs: row.generated_at_ms,
      latestObservedAtMs: row.latest_observed_at_ms,
      payload: JSON.parse(row.payload_json),
    }, { headers: { 'Cache-Control': 'public, max-age=60' } });
    await cache.put(key, response.clone());
  }
  const confirmed = await cache.match(key);
  return { initialCache, confirmedCache: confirmed ? 'hit' : 'miss', summaryFound: Boolean(confirmed), d1: database };
}

export async function ownerIncidentAuditWorkload(db, sequence) {
  if (!db || typeof db.prepare !== 'function' || typeof db.batch !== 'function') fail('Missing SCHEMA_DB binding');
  const slot = sequenceSlot(sequence);
  const fixtureId = `feasibility-v2-${sequence}`;
  const results = await db.batch([
    db.prepare(`INSERT INTO incidents (id, service_id, title, state, created_at_ms, resolved_at_ms, version)
      VALUES (?, 'portfolio', 'Synthetic feasibility incident', 'investigating', ?, NULL, 1)
      ON CONFLICT(id) DO NOTHING`).bind(`${fixtureId}-incident`, slot),
    db.prepare(`INSERT INTO owner_audit_events
      (id, actor_subject, action, resource_id, occurred_at_ms, request_id)
      VALUES (?, 'synthetic-owner', 'incident_create', ?, ?, ?)
      ON CONFLICT(id) DO NOTHING`).bind(
      `${fixtureId}-audit`, `${fixtureId}-incident`, slot, `${fixtureId}-request`,
    ),
    db.prepare('SELECT id FROM incidents WHERE id = ? LIMIT 1').bind(`${fixtureId}-incident`),
    db.prepare('SELECT id FROM owner_audit_events WHERE id = ? LIMIT 1').bind(`${fixtureId}-audit`),
  ]);
  return {
    incidentFound: Boolean(results[2]?.results?.length),
    auditFound: Boolean(results[3]?.results?.length),
    d1: d1Results(results),
  };
}

async function runCase(caseName, env, config, sequence) {
  if (caseName.startsWith('auth_')) return authWorkload(caseName, config);
  if (caseName === 'public_jwks_import') return publicJwksImportWorkload(env.PUBLIC_JWKS_URL);
  if (caseName === 'collector_http_failure') return collectorFailureWorkload();
  if (caseName === 'collector_timeout') {
    const fetchImpl = async (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('synthetic abort')), { once: true });
    });
    return collectorFailureWorkload({ fetchImpl, timeoutMs: 10_000 });
  }
  if (caseName.startsWith('metrics_')) return metricWorkload(Number(caseName.slice(8)), config.fixtures.nowMs);
  if (caseName === 'schema_batch') return schemaBatchWorkload(env.SCHEMA_DB, sequence);
  if (caseName === 'summary_cache') return materializedSummaryCacheWorkload(env.SCHEMA_DB, caches.default);
  return ownerIncidentAuditWorkload(env.SCHEMA_DB, sequence);
}

function unavailable() {
  return Response.json({ error: 'feasibility_disabled' }, {
    status: 503,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);
    const caseName = url.pathname.startsWith('/v1/') ? url.pathname.slice(4) : '';
    let config;
    try {
      if (request.method !== 'POST' || url.hostname !== BENCHMARK_HOST || url.port || url.search || url.hash
        || !CASE_SET.has(caseName)) return unavailable();
      config = validateBenchmarkConfig(env);
    } catch {
      return unavailable();
    }
    const sequenceText = request.headers.get('X-Benchmark-Sequence');
    if (!/^\d{1,2}$/.test(sequenceText ?? '')) return unavailable();
    const sequence = Number(sequenceText);
    if (sequence >= 40) return unavailable();
    const ordinal = ++isolateInvocationOrdinal;
    try {
      const result = await runCase(caseName, env, config, sequence);
      return Response.json({
        case: caseName,
        isolateInvocationOrdinal: ordinal,
        isolateFirstInvocation: ordinal === 1,
        result,
      }, { headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
    } catch (error) {
      return Response.json({
        case: caseName,
        isolateInvocationOrdinal: ordinal,
        isolateFirstInvocation: ordinal === 1,
        error: 'benchmark_case_failed',
        ...(error instanceof PublicJwksError ? { stage: error.stage } : {}),
      }, {
        status: 500,
        headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
      });
    }
  },
};
