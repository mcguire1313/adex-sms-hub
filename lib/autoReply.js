const STRONG_PATTERNS = [
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

const WEAK_PATTERNS = [
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

export function classifyAutoReply(body) {
  if (typeof body !== 'string' || body.length < 12) {
    return { isAuto: false, confidence: 0, reasons: [] };
  }
  const reasons = [];
  let score = 0;
  for (const re of STRONG_PATTERNS) if (re.test(body)) { score += 2; reasons.push(re.source); }
  for (const re of WEAK_PATTERNS) if (re.test(body)) { score += 1; reasons.push(re.source); }
  return { isAuto: score >= 2, confidence: score, reasons };
}
