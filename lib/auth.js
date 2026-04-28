function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function requireApiAuth(req, res) {
  const expected = process.env.API_AUTH_TOKEN;
  if (!expected) {
    res.status(500).json({ error: 'API_AUTH_TOKEN not configured' });
    return false;
  }
  const header = req.headers.authorization || '';
  const presented = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!timingSafeEqual(presented, expected)) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
