import { getServiceClient } from '../../../lib/supabase';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { to, body, source='manual' } = req.body;
  if (!to || !body) return res.status(400).json({ error: 'Missing to and body' });
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const message = await client.messages.create({ body, messagingServiceSid:process.env.TWILIO_MESSAGING_SERVICE_SID, to });
    const supabase = getServiceClient();
    await supabase.from('sms_messages').insert({ direction:'outbound', from_number:process.env.TWILIO_PHONE_NUMBER, to_number:to, body, twilio_sid:message.sid, status:message.status, source });
    res.status(200).json({ success:true, sid:message.sid, status:message.status });
  } catch(err) { console.error('Send SMS error:',err); res.status(500).json({ error:err.message }); }
}
