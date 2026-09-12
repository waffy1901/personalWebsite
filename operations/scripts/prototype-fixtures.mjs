// Generated per run; these fixtures are not credentials for a real account.
export async function signatureFixture(nowMs = Date.now()) {
  const keys = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = { iss: 'https://prototype.invalid', aud: ['prototype'], sub: 'fixture-owner', iat: Math.floor(nowMs / 1000), exp: Math.floor(nowMs / 1000) + 600 };
  const input = `${encode({ alg: 'RS256' })}.${encode(claims)}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keys.privateKey, new TextEncoder().encode(input));
  return { token: `${input}.${Buffer.from(signature).toString('base64url')}`, publicJwk: await crypto.subtle.exportKey('jwk', keys.publicKey), issuer: claims.iss, audience: 'prototype', ownerSubject: claims.sub, nowMs };
}
