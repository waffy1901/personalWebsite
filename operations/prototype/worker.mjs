// Disposable staging workload only. Never import this module into the production Worker.
// It has no public API or management handler and requires a separate scratch D1 binding.
export const PROBE_URL = 'https://waffy.dev/';

export async function probeWorkload({ fetchImpl = fetch, clock = () => performance.now(), timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = clock();
  try {
    const response = await fetchImpl(PROBE_URL, {
      method: 'GET', redirect: 'manual', signal: controller.signal,
      headers: { 'User-Agent': 'Waffy-Operations-Prototype/1.0', 'Cache-Control': 'no-cache' },
    });
    const durationMs = Math.max(0, clock() - started);
    clearTimeout(timer);
    // Headers are the endpoint of the measurement. Never read or store the response body.
    if (response.body) void response.body.cancel().catch(() => {});
    return {
      outcome: response.status >= 200 && response.status < 300 ? 'success'
        : response.status >= 300 && response.status < 400 ? 'redirect_error' : 'http_error',
      httpStatus: response.status, durationMs,
    };
  } catch {
    return { outcome: controller.signal.aborted ? 'timeout' : 'network_error', httpStatus: null, durationMs: Math.max(0, clock() - started) };
  } finally {
    clearTimeout(timer);
  }
}

function decodeBase64Url(value) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0));
}

// Representative JWT crypto/claim workload, not production Access authorization.
// Trusted inputs come only from local fixtures or an explicitly approved staging setup.
// JWKS retrieval/rotation and a real Access application remain Phase 3 work.
export async function signatureWorkload({ token, publicJwk, issuer, audience, ownerSubject, nowMs }) {
  if (typeof token !== 'string' || token.length > 8192 || !issuer || !audience || !ownerSubject
    || !Number.isSafeInteger(nowMs) || nowMs < 0) throw new Error('Invalid prototype inputs');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const header = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[0])));
  const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(parts[1])));
  if (header.alg !== 'RS256' || header.crit !== undefined || claims.iss !== issuer
    || !Array.isArray(claims.aud) || !claims.aud.includes(audience) || claims.sub !== ownerSubject
    || !Number.isSafeInteger(claims.exp) || claims.exp * 1000 <= nowMs
    || !Number.isSafeInteger(claims.iat) || claims.iat * 1000 > nowMs
    || (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || claims.nbf * 1000 > nowMs))) {
    throw new Error('Invalid token claims');
  }
  const key = await crypto.subtle.importKey('jwk', publicJwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decodeBase64Url(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))) {
    throw new Error('Invalid token signature');
  }
  return true;
}

export async function databaseWorkload(db, { slot, observedAt, primary, confirmation = null }) {
  if (!Number.isSafeInteger(slot) || slot < 0 || slot % 300000 !== 0) throw new Error('Invalid slot');
  if (!Number.isSafeInteger(observedAt) || observedAt < slot) throw new Error('Invalid observation time');
  // This schema is deliberately separate from operations/migrations: fixtures cannot
  // become production observations. D1 meta reports actual rows scanned/written.
  const statements = [db.prepare(`INSERT INTO prototype_samples
    (slot, observed_at_ms, outcome, http_status, duration_ms, confirmation_json)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(slot) DO NOTHING`)
    .bind(slot, observedAt, primary.outcome, primary.httpStatus, primary.durationMs, confirmation ? JSON.stringify(confirmation) : null),
  db.prepare(`SELECT outcome, COUNT(*) AS samples FROM prototype_samples
    WHERE slot >= ? GROUP BY outcome`).bind(slot - 86400000),
  db.prepare(`DELETE FROM prototype_samples WHERE slot IN
    (SELECT slot FROM prototype_samples WHERE slot < ? ORDER BY slot LIMIT 100)`).bind(slot - 2592000000)];
  return db.batch(statements);
}

export default {
  async fetch(request, env = {}) {
    if (env.PROTOTYPE_ONLY === 'true' && request.method === 'GET'
      && new URL(request.url).pathname === '/prototype/auth') {
      try {
        await signatureWorkload({
          token: request.headers.get('Cf-Access-Jwt-Assertion'),
          publicJwk: JSON.parse(env.PROTOTYPE_PUBLIC_JWK), issuer: env.PROTOTYPE_ISSUER,
          audience: env.PROTOTYPE_AUDIENCE, ownerSubject: env.PROTOTYPE_SUBJECT, nowMs: Date.now(),
        });
        return Response.json({ workload: 'prototype-auth', verified: true }, {
          headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
        });
      } catch {
        return Response.json({ error: 'unauthorized' }, {
          status: 401, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
        });
      }
    }
    return Response.json({ error: 'prototype_only' }, {
      status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
    });
  },
  async scheduled(event, env) {
    if (env.PROTOTYPE_ONLY !== 'true' || !env.PROTOTYPE_DB) throw new Error('Prototype is not configured');
    const primary = await probeWorkload();
    const confirmation = primary.outcome === 'success' ? null : await probeWorkload();
    const results = await databaseWorkload(env.PROTOTYPE_DB, {
      slot: event.scheduledTime, observedAt: Date.now(), primary, confirmation,
    });
    console.log(JSON.stringify({ workload: 'prototype', database: results.map(({ meta }) => ({ rowsRead: meta?.rows_read, rowsWritten: meta?.rows_written })) }));
  },
};
