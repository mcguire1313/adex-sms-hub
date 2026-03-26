import { getServiceClient } from '../../../lib/supabase';
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { contact } = req.query;
  if (!contact) return res.status(400).json({ error: 'Missing contact' });
  try {
    const supabase = getServiceClient();
    const { data:messages, error } = await supabase.from('sms_messages').select('*').or('from_number.eq.'+contact+',to_number.eq.'+contact).order('created_at',{ascending:true});
    if (error) throw error;
    await supabase.from('sms_messages').update({read:true}).eq('from_number',contact).eq('direction','inbound').eq('read',false);
    const clean = contact.replace('+1','').replace('+','');
    const { data:clinicians } = await supabase.from('clinicians').select('first_name,last_name,email,phone').eq('phone',clean).limit(1);
    const c = clinicians&&clinicians.length>0 ? clinicians[0] : null;
    res.status(200).json({ contact_number:contact, contact_name:c?((c.first_name||'')+' '+(c.last_name||'')).trim():null, contact_email:c?c.email:null, messages });
  } catch(err) { console.error('Thread error:',err); res.status(500).json({ error:err.message }); }
}
