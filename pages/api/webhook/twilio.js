import { getServiceClient } from '../../../lib/supabase';
export const config = { api: { bodyParser: true } };
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { MessageSid, From, To, Body } = req.body;
    const supabase = getServiceClient();
    await supabase.from('sms_messages').insert({ direction:'inbound', from_number:From, to_number:To, body:Body||'', twilio_sid:MessageSid, status:'received', source:'inbound', read:false });
    if (Body && /^(stop|unsubscribe|quit|cancel)$/i.test(Body.trim())) {
      await supabase.from('clinicians').update({ sms_opt_out:true, sms_opt_out_at:new Date().toISOString() }).eq('phone', From.replace('+1',''));
    }
    res.setHeader('Content-Type','text/xml');
    res.status(200).send('<Response></Response>');
  } catch(err) { console.error('Webhook error:',err); res.setHeader('Content-Type','text/xml'); res.status(200).send('<Response></Response>'); }
}
