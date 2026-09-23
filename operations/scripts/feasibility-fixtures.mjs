const RSA_PARAMS = {
  name: 'RSASSA-PKCS1-v1_5',
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
};

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

async function generateSigningKey(kid) {
  const pair = await crypto.subtle.generateKey(RSA_PARAMS, true, ['sign', 'verify']);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return {
    privateKey: pair.privateKey,
    publicJwk: { ...publicJwk, kid, alg: 'RS256', use: 'sig' },
  };
}

async function signToken(key, kid, claims) {
  const input = `${encodeJson({ alg: 'RS256', kid, typ: 'JWT' })}.${encodeJson(claims)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input));
  return `${input}.${Buffer.from(signature).toString('base64url')}`;
}

export async function createFeasibilityFixtures(nowMs) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) throw new TypeError('nowMs must be a nonnegative integer');
  const [first, second] = await Promise.all([
    generateSigningKey('feasibility-key-a'),
    generateSigningKey('feasibility-key-b'),
  ]);
  const issuer = 'https://feasibility.invalid';
  const audience = 'feasibility-v2';
  const ownerSubject = 'synthetic-owner';
  const issuedAt = Math.floor(nowMs / 1000);
  const baseClaims = { iss: issuer, aud: [audience], sub: ownerSubject, iat: issuedAt, exp: issuedAt + 3600 };
  const valid = await signToken(first.privateKey, first.publicJwk.kid, baseClaims);
  const deniedClaim = await signToken(first.privateKey, first.publicJwk.kid, {
    ...baseClaims, sub: 'denied-synthetic-owner',
  });
  const rotation = await signToken(second.privateKey, second.publicJwk.kid, baseClaims);
  const parts = valid.split('.');
  const tamperedSignature = Buffer.from(parts[2], 'base64url');
  tamperedSignature[0] ^= 1;

  // Only synthetic tokens and public JWKs leave this function. Private keys stay in local memory.
  return {
    version: 1,
    nowMs,
    issuer,
    audience,
    ownerSubject,
    jwks: { keys: [first.publicJwk, second.publicJwk] },
    tokens: {
      valid,
      deniedClaim,
      deniedSignature: `${parts[0]}.${parts[1]}.${tamperedSignature.toString('base64url')}`,
      rotation,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const nowMs = Number(process.argv[2]);
  console.log(JSON.stringify(await createFeasibilityFixtures(nowMs)));
}
