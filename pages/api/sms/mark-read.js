import { getServiceClient } from '../../../lib/supabase';
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { contact } = req.body;
  if (!contact) return res.status(400).json({ error: 'Missing contact' });
  try {
    const supabase = getServiceClient();
    await supabase.from('sms_messages').update({read:true}).eq('from_number',contact).eq('direction','inbound').eq('read',false);
    res.status(200).json({ success:true });
  } catch(err) { res.status(500).json({ error:err.message }); }
}
