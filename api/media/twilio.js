// Proxies a Twilio MMS media asset. Twilio media URLs require HTTP basic auth
// with the account credentials, so the browser can't hit them directly. We
// authenticate server-side and stream the response back to the client.
//
// Usage from the UI:
//   <img src={`/api/media/twilio?messageSid=${sid}&mediaSid=${mediaSid}`} />
//
// Both query params are required and validated against Twilio's own SID
// format (avoids being turned into an open redirect).

const SID_RE = /^[A-Z]{2}[0-9a-fA-F]{32}$/;

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messageSid, mediaSid } = req.query;
  if (typeof messageSid !== 'string' || !SID_RE.test(messageSid)) {
    return res.status(400).json({ error: 'Invalid messageSid' });
  }
  if (typeof mediaSid !== 'string' || !SID_RE.test(mediaSid)) {
    return res.status(400).json({ error: 'Invalid mediaSid' });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return res.status(500).json({ error: 'Twilio credentials not configured' });
  }

  // Twilio media is hosted under api.twilio.com; it 302-redirects to a signed
  // S3 URL. fetch follows the redirect automatically (basic auth is only
  // required on the first hop).
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}/Media/${mediaSid}`;
  const auth = 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  let upstream;
  try {
    upstream = await fetch(url, { headers: { Authorization: auth }, redirect: 'follow' });
  } catch (err) {
    console.error('twilio media proxy fetch failed', err);
    return res.status(502).json({ error: 'Upstream fetch failed' });
  }

  if (!upstream.ok) {
    return res.status(upstream.status).json({ error: `Upstream returned ${upstream.status}` });
  }

  const ct = upstream.headers.get('content-type') || 'application/octet-stream';
  const cl = upstream.headers.get('content-length');
  res.setHeader('Content-Type', ct);
  if (cl) res.setHeader('Content-Length', cl);
  // Browsers can cache for a few minutes; the underlying URL is stable for
  // the life of the message in Twilio (~30 days by default).
  res.setHeader('Cache-Control', 'private, max-age=600');

  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  const buf = Buffer.from(await upstream.arrayBuffer());
  res.status(200).send(buf);
}
