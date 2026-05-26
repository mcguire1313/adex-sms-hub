import { getServiceClient } from '../../../lib/supabase';
import { isE164, stripCountry } from '../../../lib/phone';
import { lineById } from '../../../lib/lines';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { contact, line: lineId, since } = req.query;
  if (!isE164(contact)) return res.status(400).json({ error: 'Invalid contact (must be E.164)' });
  const line = lineById(lineId);
  if (!line) return res.status(400).json({ error: 'Invalid line' });

  // Validate `since` if present: must be ISO-parseable. Bad value -> ignore it
  // and fall back to full-history fetch (preserves the pre-Phase-2 behavior).
  //
  // IMPORTANT: do NOT pass `since` through `new Date(...).toISOString()` — JS
  // Date only has millisecond precision, but Postgres `timestamptz` has
  // microsecond precision. Truncating "...188341+00" to "...188Z" makes the
  // SQL `created_at > sinceIso` match the same row on every poll, causing
  // duplicate messages to accumulate client-side. Validate format, then pass
  // the original string through verbatim.
  let sinceIso = null;
  if (typeof since === 'string' && since) {
    const d = new Date(since);
    if (!Number.isNaN(d.getTime())) sinceIso = since;
  }

  try {
    const supabase = getServiceClient();
    let query = supabase
      .from('sms_messages')
      .select('*')
      .or(
        `and(from_number.eq.${contact},to_number.eq.${line.number}),and(from_number.eq.${line.number},to_number.eq.${contact})`
      )
      .order('created_at', { ascending: true });
    if (sinceIso) query = query.gt('created_at', sinceIso);
    const { data: messages, error } = await query;
    if (error) throw error;

    // Always mark inbound-from-contact as read on thread open. We *don't* gate
    // this on `since` because a new inbound might have arrived after the
    // user's last poll but before they came back to the tab.
    await supabase
      .from('sms_messages')
      .update({ read: true })
      .eq('from_number', contact)
      .eq('to_number', line.number)
      .eq('direction', 'inbound')
      .eq('read', false);

    // Contact metadata: skip the lookup on incremental polls so they're cheap.
    let contactName = null;
    let contactEmail = null;
    if (!sinceIso) {
      const clean = stripCountry(contact);
      const { data: clinicians } = await supabase
        .from('clinicians')
        .select('first_name,last_name,email,phone')
        .eq('phone', clean)
        .limit(1);
      const c = clinicians && clinicians.length > 0 ? clinicians[0] : null;
      contactName = c ? ((c.first_name || '') + ' ' + (c.last_name || '')).trim() : null;
      contactEmail = c ? c.email : null;
    }

    res.status(200).json({
      contact_number: contact,
      line_id: line.id,
      line_label: line.label,
      line_number: line.number,
      line_color: line.color,
      contact_name: contactName,
      contact_email: contactEmail,
      messages,
      incremental: !!sinceIso,
    });
  } catch (err) {
    console.error('Thread error:', err);
    res.status(500).json({ error: err.message });
  }
}
