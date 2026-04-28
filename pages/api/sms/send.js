import { getServiceClient } from '../../../lib/supabase';
import { requireApiAuth } from '../../../lib/auth';
import { isE164 } from '../../../lib/phone';
import { lineById } from '../../../lib/lines';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiAuth(req, res)) return;
  const { to, body, source = 'manual', line: lineId } = req.body;
  if (!isE164(to)) return res.status(400).json({ error: 'Invalid to (must be E.164)' });
  if (typeof body !== 'string' || body.length === 0 || body.length > 1600) {
    return res.status(400).json({ error: 'Invalid body' });
  }
  const line = lineById(lineId);
  if (!line) return res.status(400).json({ error: 'Invalid line' });

  try {
    let externalSid = null;
    let status = 'queued';

    if (line.id === 'twilio') {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const message = await client.messages.create({
        body,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        to,
      });
      externalSid = message.sid;
      status = message.status;
    } else if (line.id === 'quo') {
      const apiKey = process.env.QUO_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'QUO_API_KEY not configured' });
      const r = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: body, from: line.number, to: [to] }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('Quo send failed:', r.status, j);
        return res.status(r.status).json({ error: j.message || j.error || `Quo API error ${r.status}` });
      }
      const m = j.data || j;
      externalSid = m.id || null;
      status = m.status || 'queued';
    } else {
      return res.status(400).json({ error: 'Unknown line' });
    }

    const supabase = getServiceClient();
    await supabase.from('sms_messages').insert({
      direction: 'outbound',
      from_number: line.number,
      to_number: to,
      body,
      twilio_sid: externalSid,
      status,
      source,
    });
    res.status(200).json({ success: true, sid: externalSid, status });
  } catch (err) {
    console.error('Send SMS error:', err);
    res.status(500).json({ error: err.message });
  }
}
