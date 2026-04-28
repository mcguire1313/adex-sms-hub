import { getServiceClient } from '../../../lib/supabase';
import { requireApiAuth } from '../../../lib/auth';
import { isE164, stripCountry } from '../../../lib/phone';
import { lineById } from '../../../lib/lines';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireApiAuth(req, res)) return;
  const { contact, line: lineId } = req.query;
  if (!isE164(contact)) return res.status(400).json({ error: 'Invalid contact (must be E.164)' });
  const line = lineById(lineId);
  if (!line) return res.status(400).json({ error: 'Invalid line' });

  try {
    const supabase = getServiceClient();
    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('*')
      .or(
        `and(from_number.eq.${contact},to_number.eq.${line.number}),and(from_number.eq.${line.number},to_number.eq.${contact})`
      )
      .order('created_at', { ascending: true });
    if (error) throw error;

    await supabase
      .from('sms_messages')
      .update({ read: true })
      .eq('from_number', contact)
      .eq('to_number', line.number)
      .eq('direction', 'inbound')
      .eq('read', false);

    const clean = stripCountry(contact);
    const { data: clinicians } = await supabase
      .from('clinicians')
      .select('first_name,last_name,email,phone')
      .eq('phone', clean)
      .limit(1);
    const c = clinicians && clinicians.length > 0 ? clinicians[0] : null;

    res.status(200).json({
      contact_number: contact,
      line_id: line.id,
      line_label: line.label,
      line_number: line.number,
      line_color: line.color,
      contact_name: c ? ((c.first_name || '') + ' ' + (c.last_name || '')).trim() : null,
      contact_email: c ? c.email : null,
      messages,
    });
  } catch (err) {
    console.error('Thread error:', err);
    res.status(500).json({ error: err.message });
  }
}
