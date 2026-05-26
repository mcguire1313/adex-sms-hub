import crypto from 'crypto';
import { getServiceClient } from '../../../lib/supabase';
import { classifyAutoReply } from '../../../lib/autoReply';
import { stripCountry } from '../../../lib/phone';
import { LINES } from '../../../lib/lines';
import { readRawBody } from '../../../lib/rawBody';

// We need raw bytes for HMAC verification, so disable Next's body parser.
export const config = { api: { bodyParser: false } };

const QUO_LINE = LINES.find((l) => l.id === 'quo');

// OpenPhone signing header format (v1):
//   openphone-signature: "hmac;1;<timestamp-ms>;<base64-hmac-sha256>"
//   secret = base64(rawSecret)
//   data signed = `${timestamp}.${rawBodyString}`
// Reference: https://www.openphone.com/docs/webhooks
function verifyOpenPhoneSignature(headerValue, rawBody, base64Secret) {
  if (!headerValue || !base64Secret) return false;
  const parts = headerValue.split(';');
  if (parts.length !== 4 || parts[0] !== 'hmac' || parts[1] !== '1') return false;
  const ts = parts[2];
  const presented = parts[3];
  if (!/^\d+$/.test(ts)) return false;

  // Reject very-stale or very-future timestamps to block replay (±5 min).
  const nowMs = Date.now();
  const tsMs = parseInt(ts, 10);
  if (Math.abs(nowMs - tsMs) > 5 * 60 * 1000) return false;

  let keyBytes;
  try { keyBytes = Buffer.from(base64Secret, 'base64'); }
  catch { return false; }

  const data = Buffer.concat([Buffer.from(ts + '.'), rawBody]);
  const expected = crypto.createHmac('sha256', keyBytes).update(data).digest('base64');

  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// OpenPhone media is typically an array of public CDN URLs OR objects with
// { url, type }. Normalize to our shape.
function extractOpenPhoneMedia(obj) {
  const raw = obj?.media;
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    if (typeof m === 'string') return { url: m, contentType: null, provider: 'openphone', sid: null };
    return {
      url: m.url || m.href || null,
      contentType: m.type || m.contentType || null,
      provider: 'openphone',
      sid: m.id || null,
    };
  }).filter((m) => m.url);
}

function pickInboundFields(payload) {
  const obj = payload?.data?.object || payload?.object || payload || {};
  const direction = obj.direction === 'incoming' ? 'inbound'
                  : obj.direction === 'outgoing' ? 'outbound'
                  : null;
  let toNumber = Array.isArray(obj.to) ? obj.to[0] : obj.to;
  return {
    direction,
    from_number: obj.from || null,
    to_number: toNumber || null,
    body: obj.body || obj.text || '',
    external_sid: obj.id || null,
    status: obj.status || (direction === 'inbound' ? 'received' : 'queued'),
    created_at: obj.createdAt || null,
    media: extractOpenPhoneMedia(obj),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let raw;
  try { raw = await readRawBody(req); }
  catch (err) {
    console.error('openphone webhook: failed to read body', err);
    return res.status(400).json({ error: 'Bad body' });
  }

  const secret = process.env.OPENPHONE_WEBHOOK_SECRET;
  const sig = req.headers['openphone-signature'];
  if (!verifyOpenPhoneSignature(sig, raw, secret)) {
    console.warn('openphone webhook: invalid signature');
    return res.status(403).json({ error: 'Invalid signature' });
  }

  let payload;
  try { payload = JSON.parse(raw.toString('utf8')); }
  catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const eventType = payload?.type || '';
  try {
    const supabase = getServiceClient();

    if (eventType === 'message.received' || eventType === 'message.delivered' || eventType.startsWith('message.')) {
      const f = pickInboundFields(payload);

      const ourNum = QUO_LINE?.number;
      if (!ourNum || (f.from_number !== ourNum && f.to_number !== ourNum)) {
        return res.status(200).json({ ignored: true, reason: 'not-our-number' });
      }

      if (eventType !== 'message.received' && f.external_sid) {
        await supabase
          .from('sms_messages')
          .update({ status: f.status })
          .eq('twilio_sid', f.external_sid);
        return res.status(200).json({ ok: true, kind: 'status' });
      }

      if (eventType === 'message.received' && f.direction === 'inbound') {
        const verdict = classifyAutoReply(f.body);
        await supabase.from('sms_messages').insert({
          direction: 'inbound',
          from_number: f.from_number,
          to_number: f.to_number,
          body: f.body || '',
          twilio_sid: f.external_sid,
          status: 'received',
          source: 'inbound',
          read: false,
          auto_reply: verdict.isAuto,
          auto_reply_score: verdict.confidence,
          media_urls: f.media,
        });

        const isStop = f.body && /\b(stop|unsubscribe|quit|cancel)\b/i.test(f.body.trim());
        if (isStop || verdict.isAuto) {
          await supabase
            .from('clinicians')
            .update({ sms_opt_out: true, sms_opt_out_at: new Date().toISOString() })
            .eq('phone', stripCountry(f.from_number));
        }
        return res.status(200).json({ ok: true, kind: 'inbound' });
      }
    }

    return res.status(200).json({ ok: true, ignored: true, type: eventType });
  } catch (err) {
    console.error('openphone webhook error:', err);
    return res.status(200).json({ ok: false });
  }
}
