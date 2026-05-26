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

    // Helper: strip everything but digits, then drop leading 1 so US numbers
    // collapse to a 10-digit key regardless of source format. Handles all the
    // shapes we see in `clinicians.phone`: 10-digit "8132157825", E.164
    // "+18132157825", formatted "(813) 215-7825", dashed "813-215-7825", etc.
    const digitsKey = (s) => {
      if (!s) return '';
      const d = String(s).replace(/\D/g, '');
      return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
    };

    const convPhoneKeys = Array.from(
      new Set(Array.from(convMap.values()).map((c) => digitsKey(c.contact_number)))
    ).filter(Boolean);

    // Server-side `phone IN (…)` can't easily match every format the column
    // holds (10-digit, 14-char formatted, etc.) without a normalizing index.
    // Instead we pull rows whose digits-only form starts with any of our keys.
    // For thousands of contacts this would be too broad, so we keep it
    // bounded: chunk by `in` on the most common 10-digit form and a couple of
    // common formatted variants per key.
    const variantsForKey = (k) => {
      // k is 10 digits like "8132157825"
      const a = k.slice(0, 3), b = k.slice(3, 6), c = k.slice(6);
      return [
        k,                          // 8132157825
        `+1${k}`,                   // +18132157825
        `1${k}`,                    // 18132157825
        `(${a}) ${b}-${c}`,         // (813) 215-7825
        `${a}-${b}-${c}`,           // 813-215-7825
        `${a}.${b}.${c}`,           // 813.813.7825
      ];
    };
    const allVariants = [];
    for (const k of convPhoneKeys) allVariants.push(...variantsForKey(k));

    let clinicians = [];
    // Supabase URL length cap on .in() — chunk in groups of 200 variants.
    for (let i = 0; i < allVariants.length; i += 200) {
      const slice = allVariants.slice(i, i + 200);
      const { data } = await supabase
        .from('clinicians')
        .select('first_name,last_name,phone,email,do_not_text')
        .in('phone', slice);
      if (data) clinicians.push(...data);
    }

    const nameMap = new Map();
    const optOutMap = new Map();
    for (const c of clinicians) {
      const key = digitsKey(c.phone);
      if (!key) continue;
      const name = ((c.first_name || '') + ' ' + (c.last_name || '')).trim();
      if (name) nameMap.set(key, name);
      if (c.do_not_text) optOutMap.set(key, true);
    }

    const conversations = Array.from(convMap.values())
      .map((conv) => {
        const phoneKey = digitsKey(conv.contact_number);
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
