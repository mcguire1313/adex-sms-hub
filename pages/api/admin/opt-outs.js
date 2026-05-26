import { getServiceClient } from '../../../lib/supabase';
import { stripCountry, isE164 } from '../../../lib/phone';

// GET  -> { contacts: [{ first_name, last_name, phone, email, opted_out_at, reason }] }
// POST { phone, opt_out: boolean, reason?: string } -> { ok: true }
//
// 'phone' on POST may be E.164 (+15551234567) or 10-digit; we normalize.
// Opt-outs are stored on the clinicians table (sms_opt_out + sms_opt_out_at);
// a contact who isn't in clinicians can't be tracked here.
export default async function handler(req, res) {
  const supabase = getServiceClient();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('clinicians')
        .select('first_name,last_name,phone,email,sms_opt_out,sms_opt_out_at,do_not_text')
        .or('sms_opt_out.eq.true,do_not_text.eq.true')
        .order('sms_opt_out_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const contacts = (data || []).map((c) => ({
        first_name: c.first_name || '',
        last_name: c.last_name || '',
        full_name: ((c.first_name || '') + ' ' + (c.last_name || '')).trim(),
        phone: c.phone,
        email: c.email,
        opted_out_at: c.sms_opt_out_at,
        sms_opt_out: !!c.sms_opt_out,
        do_not_text: !!c.do_not_text,
      }));
      return res.status(200).json({ contacts });
    } catch (err) {
      console.error('opt-outs GET error', err);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { phone, opt_out } = req.body || {};
    if (typeof phone !== 'string' || !phone.trim()) {
      return res.status(400).json({ error: 'phone required' });
    }
    if (typeof opt_out !== 'boolean') {
      return res.status(400).json({ error: 'opt_out (boolean) required' });
    }
    let normalized = phone.trim();
    if (isE164(normalized)) normalized = stripCountry(normalized);
    else normalized = normalized.replace(/[^0-9]/g, '');
    if (!normalized) return res.status(400).json({ error: 'invalid phone' });

    try {
      const patch = opt_out
        ? { sms_opt_out: true,  sms_opt_out_at: new Date().toISOString() }
        : { sms_opt_out: false, sms_opt_out_at: null };
      const { data, error, count } = await supabase
        .from('clinicians')
        .update(patch, { count: 'exact' })
        .eq('phone', normalized)
        .select('phone');
      if (error) throw error;
      if (!data || data.length === 0) {
        return res.status(404).json({ error: 'No clinician with that phone' });
      }
      return res.status(200).json({ ok: true, affected: count ?? data.length });
    } catch (err) {
      console.error('opt-outs POST error', err);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
