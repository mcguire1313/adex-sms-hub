export const LINES = [
  { id: 'twilio', label: 'Twilio 813', number: '+18137103898', color: '#00d4aa', short: '813' },
  { id: 'tw770',  label: 'Twilio 770', number: '+17707586897', color: '#34d399', short: '770' },
  { id: 'tw412',  label: 'Twilio 412', number: '+14127048368', color: '#22d3ee', short: '412' },
  { id: 'tw402',  label: 'Twilio 402', number: '+14027874871', color: '#60a5fa', short: '402' },
  { id: 'tw470',  label: 'Twilio 470', number: '+14709124963', color: '#818cf8', short: '470' },
  { id: 'tw727',  label: 'Twilio 727', number: '+17276070933', color: '#f472b6', short: '727' },
  { id: 'tw706',  label: 'Twilio 706', number: '+17062519171', color: '#fbbf24', short: '706' },
  { id: 'tw724',  label: 'Twilio 724', number: '+17245463807', color: '#fb923c', short: '724' },
  { id: 'quo',    label: 'Quo (off)',  number: '+17276055005', color: '#a78bfa', short: 'Quo' },
];

export function lineForNumber(num) {
  if (!num) return null;
  return LINES.find((l) => l.number === num) || null;
}

export function lineById(id) {
  return LINES.find((l) => l.id === id) || null;
}
