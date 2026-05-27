import { getServiceClient } from '../../../lib/supabase';
import { isE164 } from '../../../lib/phone';
import { lineById } from '../../../lib/lines';

// Hard-delete every row in sms_messages between the SMS hub and one contact
// on one line. Irreversible — gated by the middleware auth cookie.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { contact, line: lineId } = req.body || {};
  if (!isE164(contact)) return res.status(400).json({ error: 'Invalid contact (must be E.164)' });
  const line = lineById(lineId);
  if (!line) return res.status(400).json({ error: 'Invalid line' });

  try {
    const supabase = getServiceClient();
    const { error, count } = await supabase
      .from('sms_messages')
      .delete({ count: 'exact' })
      .or(
        `and(from_number.eq.${contact},to_number.eq.${line.number}),` +
        `and(from_number.eq.${line.number},to_number.eq.${contact})`
      );
    if (error) throw error;
    res.status(200).json({ deleted: count ?? 0 });
  } catch (err) {
    console.error('Delete thread error:', err);
    res.status(500).json({ error: err.message });
  }
}
