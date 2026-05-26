import twilio from 'twilio';
import { getServiceClient } from '../../../lib/supabase';

// Twilio status callbacks are form-encoded.
export const config = { api: { bodyParser: { type: 'application/x-www-form-urlencoded' } } };

function getFullUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}${req.url}`;
}

// Twilio sends one of these strings as MessageStatus:
//   accepted, queued, sending, sent, receiving, received,
//   delivered, undelivered, failed, read
// We persist all of them verbatim so the UI can render whatever it likes.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const signature = req.headers['x-twilio-signature'];
  const url = getFullUrl(req);
  const params = req.body || {};

  if (!authToken || !signature || !twilio.validateRequest(authToken, signature, url, params)) {
    console.warn('Twilio status callback: invalid signature', { url, hasSig: !!signature });
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const { MessageSid, MessageStatus, ErrorCode } = params;
  if (!MessageSid || !MessageStatus) {
    return res.status(200).send('');
  }

  try {
    const supabase = getServiceClient();
    await supabase
      .from('sms_messages')
      .update({
        status: MessageStatus,
        // Stash error code in the body of a comment-style column would be nice,
        // but we don't want to mutate `body`. If you want richer error tracking,
        // add an `error_code` column to sms_messages.
        ...(ErrorCode ? { /* error_code: ErrorCode */ } : {}),
      })
      .eq('twilio_sid', MessageSid);

    res.status(200).send('');
  } catch (err) {
    console.error('Twilio status callback error:', err);
    // 200 to prevent Twilio retry storms while we investigate.
    res.status(200).send('');
  }
}
