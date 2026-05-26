import { getServiceClient } from '../../../lib/supabase';
import twilio from 'twilio';
import { classifyAutoReply } from '../../../lib/autoReply';
import { stripCountry } from '../../../lib/phone';

export const config = { api: { bodyParser: { type: 'application/x-www-form-urlencoded' } } };

function getFullUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}${req.url}`;
}

// Twilio MMS payloads include NumMedia + MediaUrl0/MediaContentType0 + ...
function extractTwilioMedia(params) {
  const n = parseInt(params.NumMedia || '0', 10);
  if (!Number.isFinite(n) || n <= 0) return [];
  const out = [];
  for (let i = 0; i < n; i++) {
    const url = params[`MediaUrl${i}`];
    if (!url) continue;
    // Twilio media URL looks like:
    //   .../Accounts/<AccountSid>/Messages/<MessageSid>/Media/<MediaSid>
    // We keep the full URL and let /api/media/twilio proxy it.
    const match = /\/Messages\/([^/]+)\/Media\/([^/?]+)/.exec(url);
    out.push({
      url,
      contentType: params[`MediaContentType${i}`] || null,
      provider: 'twilio',
      sid: match ? match[2] : null,
      messageSid: match ? match[1] : (params.MessageSid || null),
    });
  }
  return out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'];
  const url = getFullUrl(req);
  const params = req.body || {};

  if (!authToken || !signature || !twilio.validateRequest(authToken, signature, url, params)) {
    console.warn('Twilio webhook signature invalid', { url, hasSig: !!signature });
    return res.status(403).json({ error: 'Invalid signature' });
  }

  try {
    const { MessageSid, From, To, Body } = params;
    const media = extractTwilioMedia(params);
    const supabase = getServiceClient();
    const verdict = classifyAutoReply(Body || '');
    await supabase.from('sms_messages').insert({
      direction: 'inbound',
      from_number: From,
      to_number: To,
      body: Body || '',
      twilio_sid: MessageSid,
      status: 'received',
      source: 'inbound',
      read: false,
      auto_reply: verdict.isAuto,
      auto_reply_score: verdict.confidence,
      media_urls: media,
    });
    const isStop = Body && /\b(stop|unsubscribe|quit|cancel)\b/i.test(Body.trim());
    if (isStop || verdict.isAuto) {
      const reason = isStop ? 'stop_keyword' : 'auto_reply';
      console.log('Opting out contact:', { from: From, reason, confidence: verdict.confidence });
      await supabase.from('clinicians').update({ sms_opt_out:true, sms_opt_out_at:new Date().toISOString() }).eq('phone', stripCountry(From));
    }
    res.setHeader('Content-Type','text/xml');
    res.status(200).send('<Response></Response>');
  } catch(err) {
    console.error('Webhook error:', err);
    res.setHeader('Content-Type','text/xml');
    res.status(200).send('<Response></Response>');
  }
}
