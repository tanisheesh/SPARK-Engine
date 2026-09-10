/* Cognito ID-token verification with no JWT library.
 *
 * Node can build a public key straight from a JWK (`format: 'jwk'`), and
 * RS256 is just RSA-SHA256 over `header.payload`. That is the whole of what a
 * JWT library would do for us here, so the relay carries no dependency for it
 * and there is no third-party code sitting on the authentication path.
 *
 * What is checked, in order: signature against the pool's published keys,
 * `iss` (this pool, this region), `aud` (one of our app clients), `token_use`
 * (must be an id token, never an access token), and `exp`/`nbf` with a small
 * clock skew allowance. A token failing any of these is rejected outright -
 * there is no "warn and continue" path.
 */

const crypto = require('crypto');

const CLOCK_SKEW_SEC = 60;
const JWKS_TTL_MS = 60 * 60 * 1000;

let jwksCache = { url: null, keys: null, fetchedAt: 0 };

function b64urlToBuffer(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function decodeSegment(segment) {
  return JSON.parse(b64urlToBuffer(segment).toString('utf8'));
}

async function loadJwks(jwksUrl) {
  const fresh = jwksCache.url === jwksUrl && jwksCache.keys &&
    Date.now() - jwksCache.fetchedAt < JWKS_TTL_MS;
  if (fresh) return jwksCache.keys;

  const res = await fetch(jwksUrl);
  if (!res.ok) throw new Error(`Could not fetch JWKS (${res.status}) from ${jwksUrl}`);
  const body = await res.json();
  if (!body || !Array.isArray(body.keys)) throw new Error('JWKS response had no keys array');

  jwksCache = { url: jwksUrl, keys: body.keys, fetchedAt: Date.now() };
  return body.keys;
}

/**
 * Verifies a Cognito ID token and returns its claims.
 * @param {string} token
 * @param {{ region: string, userPoolId: string, allowedAudiences: string[] }} config
 */
async function verifyIdToken(token, config) {
  if (typeof token !== 'string' || token.split('.').length !== 3) {
    throw new Error('Malformed token');
  }
  const [headerB64, payloadB64, signatureB64] = token.split('.');

  let header, claims;
  try {
    header = decodeSegment(headerB64);
    claims = decodeSegment(payloadB64);
  } catch {
    throw new Error('Token header or payload was not valid JSON');
  }

  if (header.alg !== 'RS256') throw new Error(`Unexpected signing algorithm: ${header.alg}`);

  const issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;
  const keys = await loadJwks(`${issuer}/.well-known/jwks.json`);
  const jwk = keys.find(k => k.kid === header.kid);
  // An unknown kid usually means the pool rotated keys since we cached them,
  // so this is worth distinguishing from a genuinely bad signature.
  if (!jwk) throw new Error('Token was signed with a key this pool does not publish');

  const publicKey = crypto.createPublicKey({ key: jwk, format: 'jwk' });
  const signed = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
  const valid = crypto.verify('RSA-SHA256', signed, publicKey, b64urlToBuffer(signatureB64));
  if (!valid) throw new Error('Token signature is not valid');

  if (claims.iss !== issuer) throw new Error('Token was issued by a different user pool');
  if (claims.token_use !== 'id') throw new Error('Expected an ID token, got ' + claims.token_use);

  const audiences = [].concat(claims.aud || []);
  const allowed = config.allowedAudiences.filter(Boolean);
  if (allowed.length && !audiences.some(a => allowed.includes(a))) {
    throw new Error('Token was issued for a different app client');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && now > claims.exp + CLOCK_SKEW_SEC) {
    throw new Error('Token has expired');
  }
  if (typeof claims.nbf === 'number' && now < claims.nbf - CLOCK_SKEW_SEC) {
    throw new Error('Token is not valid yet');
  }
  if (!claims.sub) throw new Error('Token carries no subject');

  return claims;
}

module.exports = { verifyIdToken };
