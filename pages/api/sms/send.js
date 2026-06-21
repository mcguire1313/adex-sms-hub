import { getServiceClient } from '../../../lib/supabase';
import { isE164 } from '../../../lib/phone';
import { lineById } from '../../../lib/lines';

// Reject anything that isn't a same-origin Supabase Storage URL on our project.
// Prevents the send endpoint being abused to make Twilio fetch arbitrary URLs
// from an authenticated session.
function isAllowedMediaUrl(u) {
  if (typeof u !== 'string' || u.length > 1024) return false;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  if (!base) return false;
  return u.startsWith(base.replace(/\/+$/, '') + '/storage/v1/object/public/sms-media/');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { to, body, source = 'manual', line: lineId, mediaUrls } = req.body;
  if (!isE164(to)) return res.status(400).json({ error: 'Invalid to (must be E.164)' });

  // Body OR media is required. Twilio rejects a message with neither.
  const hasMedia = Array.isArray(mediaUrls) && mediaUrls.length > 0;
  if (typeof body !== 'string' || (body.length === 0 && !hasMedia) || body.length > 1600) {
    return res.status(400).json({ error: 'Invalid body' });
  }
  if (hasMedia) {
    if (mediaUrls.length > 10) return res.status(400).json({ error: 'Too many attachments (max 10)' });
    for (const u of mediaUrls) {
      if (!isAllowedMediaUrl(u)) return res.status(400).json({ error: 'Invalid media URL' });
    }
  }
  const line = lineById(lineId);
  if (!line) return res.status(400).json({ error: 'Invalid line' });

  // DNC GUARD — never let a manual send reach a number that has opted out /
  // been placed on do-not-contact (e.g. a legal / FTC removal demand). This is
  // the one path the automated suppression doesn't cover. Fail-open only on a
  // DB error so a transient hiccup can't brick the whole Hub.
  try {
    const dncClient = getServiceClient();
    const { data: optOut } = await dncClient
      .from('sms_opt_outs')
      .select('phone_number, source, opted_out_at')
      .eq('phone_number', to)
      .limit(1);
    if (optOut && optOut.length > 0) {
      const o = optOut[0];
      return res.status(403).json({
        error: `🚫 ${to} is on the DO-NOT-CONTACT list — opted out ${(o.opted_out_at || '').slice(0, 10)} (${o.source || 'opt-out'}). Send blocked.`,
      });
    }
  } catch (e) {
    console.error('DNC guard check failed (allowing send):', e);
  }

  try {
    let externalSid = null;
    let status = 'queued';

    if (line.id !== 'quo') {
      // Any Twilio line (813/770/412/402/470/727/706/724) — send from the SELECTED
      // number, not the Messaging Service pool, so the manual message goes out on
      // the same line the conversation is on.
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const payload = {
        body,
        from: line.number,
        to,
      };
      if (hasMedia) payload.mediaUrl = mediaUrls;
      const message = await client.messages.create(payload);
      externalSid = message.sid;
      status = message.status;
    } else {
      const apiKey = process.env.QUO_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'QUO_API_KEY not configured' });
      const payload = { content: body, from: line.number, to: [to] };
      if (hasMedia) payload.mediaUrl = mediaUrls;
      const r = await fetch('https://api.openphone.com/v1/messages', {
        method: 'POST',
        headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        console.error('Quo send failed:', r.status, j);
        return res.status(502).json({ error: `Quo/OpenPhone error ${r.status}: ${j.message || j.error || 'request rejected'}` });
      }
      const m = j.data || j;
      externalSid = m.id || null;
      status = m.status || 'queued';
    }

    // Build media_urls in the same shape as inbound rows so the UI renderer
    // doesn't care which direction the message went.
    const persistedMedia = hasMedia
      ? mediaUrls.map((url) => ({ url, contentType: null, provider: line.id, sid: null }))
      : [];

    const supabase = getServiceClient();
    await supabase.from('sms_messages').insert({
      direction: 'outbound',
      from_number: line.number,
      to_number: to,
      body,
      twilio_sid: externalSid,
      status,
      source,
      media_urls: persistedMedia,
    });
    res.status(200).json({ success: true, sid: externalSid, status });
  } catch (err) {
    console.error('Send SMS error:', err);
    res.status(500).json({ error: err.message });
  }
}
