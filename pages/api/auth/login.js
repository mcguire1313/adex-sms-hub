import { buildSetCookie, signSessionValue } from '../../../lib/session';

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret) {
    return res.status(500).json({ error: 'APP_PASSWORD or SESSION_SECRET not configured' });
  }
  const { password } = req.body || {};
  if (typeof password !== 'string' || !timingSafeEqual(password, expected)) {
    // Small constant-time-ish delay to slow down naive bruteforce.
    await new Promise((r) => setTimeout(r, 400));
    return res.status(401).json({ error: 'Incorrect password' });
  }
  const value = await signSessionValue(secret);
  res.setHeader('Set-Cookie', buildSetCookie(value, { secure: process.env.NODE_ENV === 'production' }));
  res.status(200).json({ success: true });
}
