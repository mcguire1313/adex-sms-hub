import { getServiceClient } from '../../../lib/supabase';
import { isE164 } from '../../../lib/phone';
import { lineById } from '../../../lib/lines';

// Bulk-delete every sms_messages row in a list of (contact, line) pairs.
// Body: { pairs: [{ contact, line }, ...] }  (max 500 per call)
// Returns: { deleted: <row count>, threads_processed: <N> }
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { pairs } = req.body || {};
  if (!Array.isArray(pairs) || pairs.length === 0) {
    return res.status(400).json({ error: 'Missing pairs[]' });
  }
  if (pairs.length > 500) {
    return res.status(400).json({ error: 'Too many pairs (max 500)' });
  }

  // Normalize + group contacts per line so we can issue one DELETE per line.
  const byLine = new Map(); // lineNumber -> Set<contact>
  for (const p of pairs) {
    if (!p || !isE164(p.contact)) continue;
    const line = lineById(p.line);
    if (!line) continue;
    if (!byLine.has(line.number)) byLine.set(line.number, new Set());
    byLine.get(line.number).add(p.contact);
  }
  if (!byLine.size) return res.status(400).json({ error: 'No valid pairs' });

  try {
    const supabase = getServiceClient();
    let totalDeleted = 0;
    for (const [lineNumber, contactSet] of byLine.entries()) {
      const contacts = Array.from(contactSet);
      // Delete all messages where the SMS hub line is `lineNumber` and the
      // other party is one of the contacts (either direction).
      const { error: e1, count: c1 } = await supabase
        .from('sms_messages')
        .delete({ count: 'exact' })
        .eq('to_number', lineNumber)
        .in('from_number', contacts);
      if (e1) throw e1;
      const { error: e2, count: c2 } = await supabase
        .from('sms_messages')
        .delete({ count: 'exact' })
        .eq('from_number', lineNumber)
        .in('to_number', contacts);
      if (e2) throw e2;
      totalDeleted += (c1 || 0) + (c2 || 0);
    }
    res.status(200).json({ deleted: totalDeleted, threads_processed: pairs.length });
  } catch (err) {
    console.error('Delete-many error:', err);
    res.status(500).json({ error: err.message });
  }
}
