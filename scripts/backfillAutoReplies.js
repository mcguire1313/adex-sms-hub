#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const STRONG = [
  /\b(not|isn'?t|aren'?t)\s+monitored\b/i,
  /\bdo\s+not\s+(reply|respond)\b/i,
  /\bthis\s+(number|line|inbox|mailbox)\s+is\s+(not|un)\s*monitored\b/i,
  /\btext\s+messages?\s+are\s+not\s+(monitored|read|checked)\b/i,
  /\bautomated\s+(reply|response|message|system)\b/i,
  /\bauto[-\s]?reply\b/i,
  /\bunable\s+to\s+(read|respond|reply)\s+to\s+(text|sms)/i,
  /\bsorry,?\s+i\s+(do(n'?| no)t|cannot|can'?t)\s+understand\b/i,
  /\bi\s+(do(n'?| no)t|cannot|can'?t)\s+understand\s+your\s+(message|text|request)\b/i,
  /\bcall\s+9\s*1\s*1\b.*\bemergency\b/i,
  /\bemergency\b.*\bcall\s+9\s*1\s*1\b/i,
];
const WEAK = [
  /\bthank\s+you\s+for\s+(contacting|reaching\s+out|your\s+message)\b/i,
  /\boffice\s+hours\b/i,
  /\bnext\s+business\s+day\b/i,
  /\bnon[-\s]?urgent\b/i,
  /\bfor\s+urgent\s+(matters|needs|issues|inquiries)\b/i,
  /\bplease\s+call\s+(your|our|the)\s+(clinic|office|pharmacy|practice)\b/i,
  /\bduring\s+(normal\s+)?business\s+hours\b/i,
  /\bvisit\s+(our|the)\s+website\b/i,
  /\b(life[-\s]?threatening)\s+emergency\b/i,
];

function classify(body) {
  if (typeof body !== 'string' || body.length < 12) return 0;
  let s = 0;
  for (const r of STRONG) if (r.test(body)) s += 2;
  for (const r of WEAK)   if (r.test(body)) s += 1;
  return s;
}

function stripCountry(v) { return (v || '').replace(/^\+1/, '').replace(/^\+/, ''); }

(async () => {
  const dryRun = process.argv.includes('--apply') ? false : true;
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
  const { data: msgs, error } = await supabase
    .from('sms_messages').select('id,from_number,body,created_at')
    .eq('direction', 'inbound').order('created_at', { ascending: false }).limit(20000);
  if (error) { console.error(error); process.exit(1); }

  const flagged = new Map();
  for (const m of msgs) {
    const score = classify(m.body);
    if (score >= 2) {
      const key = stripCountry(m.from_number);
      if (!flagged.has(key)) flagged.set(key, { score, sample: m.body.slice(0, 80), from: m.from_number });
    }
  }

  console.log(`Found ${flagged.size} contacts to opt out (mode: ${dryRun ? 'DRY-RUN' : 'APPLY'})`);
  for (const [phone, info] of flagged) {
    console.log(`  ${info.from}  score=${info.score}  "${info.sample}..."`);
  }

  if (dryRun) { console.log('\nRe-run with --apply to write changes.'); return; }

  const phones = Array.from(flagged.keys());
  const { error: updErr, count } = await supabase
    .from('clinicians')
    .update({ sms_opt_out: true, sms_opt_out_at: new Date().toISOString() }, { count: 'exact' })
    .in('phone', phones)
    .eq('sms_opt_out', false);
  if (updErr) { console.error(updErr); process.exit(1); }
  console.log(`\nUpdated ${count} clinician rows.`);
})();
