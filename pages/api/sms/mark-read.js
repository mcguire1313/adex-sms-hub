import { getServiceClient } from '../../../lib/supabase';
import { requireApiAuth } from '../../../lib/auth';
import { isE164 } from '../../../lib/phone';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiAuth(req, res)) return;
  const { contact } = req.body;
  if (!isE164(contact)) return res.status(400).json({ error: 'Invalid contact (must be E.164)' });
  try {
    const supabase = getServiceClient();
    await supabase.from('sms_messages').update({read:true}).eq('from_number',contact).eq('direction','inbound').eq('read',false);
    res.status(200).json({ success:true });
  } catch(err) { res.status(500).json({ error:err.message }); }
}
