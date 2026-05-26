// Tiny stateless session: an HMAC-signed cookie that says "this browser logged in
// with the shared APP_PASSWORD at <timestamp>". Verified on every request by
// middleware.js. No DB round-trip, no JWT library.
//
// Cookie value format: `${issuedAtSec}.${signature}`
// signature = base64url( HMAC-SHA256(SESSION_SECRET, issuedAtSec) )
//
// Implemented with Web Crypto so both the Edge runtime (middleware.js) and the
// Node runtime (login route) can call it.

const COOKIE_NAME = 'adex_sms_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

function b64urlFromBytes(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return b64urlFromBytes(new Uint8Array(sig));
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export async function signSessionValue(secret) {
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const sig = await hmacSha256(secret, issuedAt);
  return `${issuedAt}.${sig}`;
}

export async function verifySessionValue(value, secret) {
  if (!value || !secret) return false;
  const dot = value.indexOf('.');
  if (dot < 1) return false;
  const issuedAt = value.slice(0, dot);
  const presented = value.slice(dot + 1);
  if (!/^\d+$/.test(issuedAt)) return false;
  const ageSec = Math.floor(Date.now() / 1000) - parseInt(issuedAt, 10);
  if (ageSec < 0 || ageSec > MAX_AGE_SECONDS) return false;
  const expected = await hmacSha256(secret, issuedAt);
  return timingSafeEqualStr(presented, expected);
}

export function sessionCookieName() { return COOKIE_NAME; }
export function sessionMaxAge() { return MAX_AGE_SECONDS; }

export function buildSetCookie(value, { maxAge = MAX_AGE_SECONDS, secure = true } = {}) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearCookie({ secure = true } = {}) {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
