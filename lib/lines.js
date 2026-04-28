export const LINES = [
  { id: 'twilio', label: 'Twilio', number: '+18137103898', color: '#00d4aa', short: '813' },
  { id: 'quo',    label: 'Quo',    number: '+17276055005', color: '#a78bfa', short: '727' },
];

export function lineForNumber(num) {
  if (!num) return null;
  return LINES.find((l) => l.number === num) || null;
}

export function lineById(id) {
  return LINES.find((l) => l.id === id) || null;
}
