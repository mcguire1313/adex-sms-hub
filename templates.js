// Quick-reply templates stored in the browser's localStorage. Per-browser by
// design — this is a personal hub. Migrate to a Supabase table later if you
// need cross-device sync.
//
// Storage shape: { version: 1, templates: [{ id, label, body }] }

const STORAGE_KEY = 'adex_sms_templates_v1';

const DEFAULTS = [
  { id: 'greet',  label: 'Greeting',     body: 'Hi! Thanks for reaching out — quick question for you:' },
  { id: 'biz',    label: 'Business hrs', body: 'Just FYI, I respond to texts during business hours (Mon–Fri, 9–5 ET).' },
  { id: 'closed', label: 'No interest',  body: 'No problem — thanks for letting me know. I&apos;ll take you off the list.' },
];

function safeRead() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.templates)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function safeWrite(state) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

export function loadTemplates() {
  const existing = safeRead();
  if (existing) return existing.templates;
  const seeded = { version: 1, templates: DEFAULTS };
  safeWrite(seeded);
  return seeded.templates;
}

export function saveTemplates(templates) {
  safeWrite({ version: 1, templates });
}

export function newTemplate(partial = {}) {
  return {
    id: 't-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    label: partial.label || 'Untitled',
    body: partial.body || '',
  };
}
