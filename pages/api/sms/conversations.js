import { getServiceClient } from '../../../lib/supabase';
import { LINES, lineForNumber } from '../../../lib/lines';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const supabase = getServiceClient();
    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;

    const adexNumbers = new Set(LINES.map((l) => l.number));
    const convMap = new Map();

    for (const msg of messages) {
      const adexNum = msg.direction === 'inbound' ? msg.to_number : msg.from_number;
      const contact = msg.direction === 'inbound' ? msg.from_number : msg.to_number;
      if (!adexNumbers.has(adexNum)) continue;
      if (adexNumbers.has(contact)) continue;
      const line = lineForNumber(adexNum);
      const key = `${line.id}:${contact}`;
      if (!convMap.has(key)) {
        convMap.set(key, {
          key,
          line_id: line.id,
          line_label: line.label,
          line_number: line.number,
          line_color: line.color,
          contact_number: contact,
          last_message: msg.body,
          last_direction: msg.direction,
          last_message_at: msg.created_at,
          last_status: msg.status,
          unread_count: 0,
          total_messages: 0,
        });
      }
      const conv = convMap.get(key);
      conv.total_messages++;
      if (msg.direction === 'inbound' && !msg.read) conv.unread_count++;
    }

    const cleanNumbers = Array.from(
      new Set(Array.from(convMap.values()).map((c) => c.contact_number.replace('+1', '').replace('+', '')))
    );
    // Pull names + opt-out flags in a single query so we can flag conversations
    // belonging to numbers that have asked to stop. Either flag puts them in
    // the "Opted out" folder.
    const { data: clinicians } = await supabase
      .from('clinicians')
      .select('first_name,last_name,phone,email,do_not_text,sms_opt_out')
      .in('phone', cleanNumbers);
    const nameMap = new Map();
    const optOutMap = new Map();
    if (clinicians) {
      for (const c of clinicians) {
        const key = (c.phone || '').replace(/[^0-9]/g, '');
        nameMap.set(key, ((c.first_name || '') + ' ' + (c.last_name || '')).trim());
        if (c.do_not_text || c.sms_opt_out) optOutMap.set(key, true);
      }
    }

    const conversations = Array.from(convMap.values())
      .map((conv) => {
        const phoneKey = conv.contact_number.replace('+1', '').replace('+', '');
        return {
          ...conv,
          contact_name: nameMap.get(phoneKey) || null,
          opted_out: optOutMap.get(phoneKey) === true,
        };
      })
      .sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

    res.status(200).json({ conversations });
  } catch (err) {
    console.error('Conversations error:', err);
    res.status(500).json({ error: err.message });
  }
}
