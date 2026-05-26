import { buildClearCookie } from '../../../lib/session';

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  res.setHeader('Set-Cookie', buildClearCookie({ secure: process.env.NODE_ENV === 'production' }));
  res.status(200).json({ success: true });
}
