import { useEffect, useState, useCallback } from 'react';

function formatPhone(num) {
  if (!num) return '';
  const c = num.replace(/[^0-9]/g, '');
  if (c.length === 11 && c.startsWith('1')) return '(' + c.slice(1, 4) + ') ' + c.slice(4, 7) + '-' + c.slice(7);
  if (c.length === 10) return '(' + c.slice(0, 3) + ') ' + c.slice(3, 6) + '-' + c.slice(6);
  return num;
}

function fmtDate(s) {
  if (!s) return '';
  try { return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return s; }
}

export default function OptOutsModal({ open, onClose, on401 }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyPhone, setBusyPhone] = useState(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/admin/opt-outs');
      if (r.status === 401 && on401) { on401(); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setContacts(d.contacts || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [on401]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const unoptOut = async (phone) => {
    setBusyPhone(phone);
    try {
      const r = await fetch('/api/admin/opt-outs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, opt_out: false }),
      });
      if (r.status === 401 && on401) { on401(); return; }
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      setContacts((prev) => prev.filter((c) => c.phone !== phone));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyPhone(null);
    }
  };

  if (!open) return null;

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.full_name && c.full_name.toLowerCase().includes(q))
      || (c.email && c.email.toLowerCase().includes(q))
      || (c.phone && c.phone.includes(q))
      || (c.phone && formatPhone(c.phone).includes(q))
    );
  });

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 640, maxHeight: '85vh',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)', borderRadius: 12,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Opted-out contacts
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {loading ? 'Loading...' : `${contacts.length} total`}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'none', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', borderRadius: 6,
            padding: '6px 12px', fontSize: 12, cursor: 'pointer',
          }}>Close</button>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)' }}>
          <input
            type="text"
            placeholder="Search by name, phone, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: 6,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            }}
          />
        </div>

        {error && (
          <div style={{
            margin: '8px 20px 0', padding: '8px 12px',
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 6, color: 'var(--red)', fontSize: 12,
          }}>{error}</div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              Loading opt-outs...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
              {search ? 'No matches' : 'No opted-out contacts.'}
            </div>
          ) : filtered.map((c) => (
            <div key={c.phone} style={{
              padding: '12px 20px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
                  {c.full_name || formatPhone(c.phone)}
                </div>
                <div style={{
                  fontSize: 12, color: 'var(--text-muted)', marginTop: 2,
                  display: 'flex', gap: 8, flexWrap: 'wrap',
                }}>
                  <span>{formatPhone(c.phone)}</span>
                  {c.email && <span>· {c.email}</span>}
                  {c.opted_out_at && <span>· opted out {fmtDate(c.opted_out_at)}</span>}
                  {c.do_not_text && (
                    <span style={{
                      padding: '1px 6px', borderRadius: 4,
                      background: 'rgba(239,68,68,0.15)', color: 'var(--red)',
                      fontWeight: 600,
                    }}>do-not-text flag</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => unoptOut(c.phone)}
                disabled={busyPhone === c.phone}
                style={{
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-light)',
                  color: 'var(--text-primary)',
                  borderRadius: 6, padding: '6px 10px',
                  fontSize: 12, cursor: 'pointer',
                  opacity: busyPhone === c.phone ? 0.6 : 1,
                  flexShrink: 0,
                }}>
                {busyPhone === c.phone ? 'Working...' : 'Un-opt out'}
              </button>
            </div>
          ))}
        </div>

        <div style={{
          padding: '12px 20px', borderTop: '1px solid var(--border)',
          fontSize: 11, color: 'var(--text-muted)',
        }}>
          Un-opting a contact only clears the flag in your clinicians table. They
          won&apos;t suddenly get a message — they&apos;ll just stop being blocked from
          future sends.
        </div>
      </div>
    </div>
  );
}
