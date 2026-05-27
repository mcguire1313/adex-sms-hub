import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { LINES, lineById } from '../lib/lines';
import OptOutsModal from '../components/OptOutsModal';
import TemplatesMenu from '../components/TemplatesMenu';
import MediaAttachments from '../components/MediaAttachments';
import MediaComposer from '../components/MediaComposer';

// ---------- formatting helpers ----------

function formatPhone(num) {
  if (!num) return '';
  const c = num.replace(/[^0-9]/g, '');
  if (c.length === 11 && c.startsWith('1')) return '(' + c.slice(1, 4) + ') ' + c.slice(4, 7) + '-' + c.slice(7);
  if (c.length === 10) return '(' + c.slice(0, 3) + ') ' + c.slice(3, 6) + '-' + c.slice(6);
  return num;
}

function timeAgo(date) {
  const d = Math.floor((new Date() - new Date(date)) / 1000);
  if (d < 60) return 'just now';
  if (d < 3600) return Math.floor(d / 60) + 'm';
  if (d < 86400) return Math.floor(d / 3600) + 'h';
  if (d < 604800) return Math.floor(d / 86400) + 'd';
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTs(date) {
  return new Date(date).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

// ---------- responsive viewport hook ----------

function useIsNarrow(breakpoint = 760) {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const onChange = () => setNarrow(mql.matches);
    onChange();
    // Safari < 14 needs addListener
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, [breakpoint]);
  return narrow;
}

// ---------- visibility hook ----------

function useDocumentVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onChange = () => setVisible(!document.hidden);
    onChange();
    document.addEventListener('visibilitychange', onChange);
    window.addEventListener('focus', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
      window.removeEventListener('focus', onChange);
    };
  }, []);
  return visible;
}

// ---------- presentational components ----------

function LineDot({ color, size = 8 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size,
      borderRadius: '50%', background: color, flexShrink: 0,
    }} />
  );
}

function TabButton({ label, color, count, unread, active, onClick }) {
  const showUnread = unread > 0;
  return (
    <button onClick={onClick} style={{
      flex: 1,
      padding: '10px 12px',
      background: active ? 'var(--bg-tertiary)' : 'transparent',
      border: 'none',
      borderBottom: active ? `2px solid ${color || 'var(--accent)'}` : '2px solid transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: active ? 600 : 500,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      transition: 'background 0.15s, color 0.15s',
    }}>
      {color && <LineDot color={color} />}
      <span>{label}</span>
      <span style={{
        fontSize: 11,
        padding: '1px 6px',
        borderRadius: 8,
        background: showUnread ? (color || 'var(--accent)') : 'var(--bg-hover)',
        color: showUnread ? '#000' : 'var(--text-muted)',
        fontWeight: 700,
        minWidth: 20, textAlign: 'center',
      }}>
        {showUnread ? unread : count}
      </span>
    </button>
  );
}

const DELETE_ACK_KEY = 'adex_sms_delete_ack_v1';

function ConvItem({ conv, isActive, onClick, onDelete }) {
  const u = conv.unread_count > 0;
  const handleDeleteClick = (e) => {
    e.stopPropagation();
    // First time the user deletes a row, show a one-time agreement explaining
    // the action is permanent. After they accept, deletes are one-click.
    let acknowledged = false;
    try { acknowledged = localStorage.getItem(DELETE_ACK_KEY) === 'true'; } catch {}
    if (!acknowledged) {
      const ok = window.confirm(
        'Heads up — deleting a conversation permanently removes every ' +
        'message in it from the database. This cannot be undone.\n\n' +
        'Click OK to delete this conversation. You won\'t be asked again ' +
        'for future deletions.'
      );
      if (!ok) return;
      try { localStorage.setItem(DELETE_ACK_KEY, 'true'); } catch {}
    }
    onDelete(conv);
  };
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', cursor: 'pointer',
      background: isActive ? 'var(--bg-tertiary)' : 'transparent',
      borderBottom: '1px solid var(--border)',
      borderLeft: isActive ? `3px solid ${conv.line_color}` : '3px solid transparent',
      transition: 'background 0.12s',
      position: 'relative',
    }}
    onMouseEnter={(e) => {
      if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)';
      const btn = e.currentTarget.querySelector('[data-delete-btn]');
      if (btn) btn.style.opacity = '1';
    }}
    onMouseLeave={(e) => {
      if (!isActive) e.currentTarget.style.background = 'transparent';
      const btn = e.currentTarget.querySelector('[data-delete-btn]');
      if (btn) btn.style.opacity = '0';
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: u ? conv.line_color : 'var(--bg-tertiary)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, fontWeight: 700,
        color: u ? '#000' : 'var(--text-secondary)',
      }}>
        {(conv.contact_name || '?')[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
          <span style={{
            fontWeight: u ? 700 : 500, fontSize: 14,
            color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {conv.contact_name || formatPhone(conv.contact_number)}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, marginLeft: 8 }}>
            {timeAgo(conv.last_message_at)}
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 13,
            color: u ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: u ? 500 : 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
          }}>
            {conv.last_direction === 'outbound' ? 'You: ' : ''}{conv.last_message}
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 600,
            color: conv.line_color,
            padding: '2px 6px', borderRadius: 4,
            background: 'rgba(255,255,255,0.04)',
            flexShrink: 0,
          }}>
            <LineDot color={conv.line_color} size={6} />
            {conv.line_label}
          </span>
          {u && (
            <span style={{
              background: conv.line_color, color: '#000',
              fontSize: 11, fontWeight: 700, borderRadius: 10,
              padding: '1px 7px', flexShrink: 0,
            }}>{conv.unread_count}</span>
          )}
        </div>
      </div>
      <button
        data-delete-btn
        onClick={handleDeleteClick}
        title="Delete this conversation (cannot be undone)"
        style={{
          opacity: 0,
          transition: 'opacity 0.12s, background 0.12s',
          background: 'transparent',
          border: '1px solid var(--border-light)',
          color: 'var(--text-muted)',
          borderRadius: 6,
          width: 28, height: 28,
          fontSize: 14, lineHeight: 1,
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
          e.currentTarget.style.color = '#ef4444';
          e.currentTarget.style.borderColor = '#ef4444';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.borderColor = 'var(--border-light)';
        }}
      >✕</button>
    </div>
  );
}

function MsgBubble({ msg, lineColor, onRetry }) {
  const o = msg.direction === 'outbound';
  const sending = msg._optimistic && !msg._error;
  const failed = (!msg._optimistic && (msg.status === 'failed' || msg.status === 'undelivered')) || msg._error;
  const outboundBg = failed ? 'rgba(239,68,68,0.15)' : `${lineColor}1f`;
  const outboundBorder = failed ? 'rgba(239,68,68,0.3)' : `${lineColor}33`;
  return (
    <div style={{ display: 'flex', justifyContent: o ? 'flex-end' : 'flex-start', marginBottom: 8, animation: 'fadeIn 0.2s ease' }}>
      <div style={{
        maxWidth: '75%',
        padding: '10px 14px',
        borderRadius: 16,
        borderBottomRightRadius: o ? 4 : 16,
        borderBottomLeftRadius: o ? 16 : 4,
        background: o ? outboundBg : 'var(--bg-tertiary)',
        border: `1px solid ${o ? outboundBorder : 'var(--border)'}`,
        opacity: sending ? 0.75 : 1,
      }}>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
          {msg.body}
        </div>
        <MediaAttachments media={msg.media_urls} />
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 6,
          justifyContent: o ? 'flex-end' : 'flex-start',
        }}>
          {sending ? 'Sending...' : formatTs(msg.created_at)}
          {o && !sending && (
            <span style={{ color: failed ? 'var(--red)' : msg.status === 'delivered' ? 'var(--green)' : 'var(--text-muted)' }}>
              {failed ? '! Failed' : msg.status === 'delivered' ? '✓✓' : '✓'}
            </span>
          )}
          {failed && msg._optimistic && onRetry && (
            <button onClick={() => onRetry(msg)} style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--red)', cursor: 'pointer', fontSize: 11,
              textDecoration: 'underline',
            }}>retry</button>
          )}
          {msg.source && msg.source !== 'manual' && msg.source !== 'inbound' && (
            <span style={{
              fontSize: 10, padding: '1px 5px', borderRadius: 4,
              background: 'var(--bg-hover)', color: 'var(--text-muted)',
            }}>
              {msg.source}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- main ----------

export default function SMSHub() {
  const router = useRouter();
  const isNarrow = useIsNarrow();
  const visible = useDocumentVisible();

  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(null);
  // Outbound messages we've shown locally but haven't seen come back from the
  // server yet. Keyed by tempId. Each: { tempId, body, created_at, contact,
  // line, _optimistic: true, _error: string | null, status }
  const [pendingByThread, setPendingByThread] = useState({});
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newNum, setNewNum] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState('all');
  const [newLine, setNewLine] = useState(LINES[0].id);
  const [sendError, setSendError] = useState('');
  const [showOptOuts, setShowOptOuts] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [view, setView] = useState('inbox'); // 'inbox' | 'opted_out' | 'archive'
  // Archive state lives in localStorage so it persists without a DB migration.
  // Stored as an array of conv keys ("lineId:contactNumber"); we hydrate into
  // a Set for O(1) lookups.
  const [archivedKeys, setArchivedKeys] = useState(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = window.localStorage.getItem('adex_sms_archived_v1');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  const persistArchive = useCallback((next) => {
    try {
      window.localStorage.setItem('adex_sms_archived_v1', JSON.stringify(Array.from(next)));
    } catch {}
  }, []);
  const [kbIndex, setKbIndex] = useState(-1);
  const [soundOn, setSoundOn] = useState(() => {
    if (typeof window === 'undefined') return true;
    try { return window.localStorage.getItem('adex_sms_sound') !== 'off'; } catch { return true; }
  });
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const searchRef = useRef(null);
  const lastMessageAtRef = useRef(null); // ISO of newest message we've seen in current thread
  // Tracks total messages per conv on the previous fetchConvs tick so we can
  // detect when a new inbound has landed AND the conversation belongs in the
  // main inbox (not opt-out, not archive). Initially null so the first
  // populated tick establishes the baseline without playing a sound.
  const prevConvSnapshotRef = useRef(null);
  const audioCtxRef = useRef(null);

  const playNewMessageSound = useCallback(() => {
    if (!soundOn || typeof window === 'undefined') return;
    try {
      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        audioCtxRef.current = new Ctx();
      }
      const ctx = audioCtxRef.current;
      // Distinctive two-note chirp: B5 (988Hz) → E6 (1319Hz), ~140ms total.
      // Sine wave with a gentle attack/release so it doesn't click.
      const now = ctx.currentTime;
      [{ f: 988, t: 0 }, { f: 1319, t: 0.07 }].forEach(({ f, t }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, now + t);
        gain.gain.linearRampToValueAtTime(0.55, now + t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + t + 0.09);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + t);
        osc.stop(now + t + 0.1);
      });
    } catch (e) { /* audio is best-effort */ }
  }, [soundOn]);

  // --------- data fetchers ----------

  const fetchConvs = useCallback(async () => {
    try {
      const r = await fetch('/api/sms/conversations');
      if (r.status === 401) { router.replace('/login'); return; }
      const d = await r.json();
      if (d.conversations) setConvs(d.conversations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Full thread fetch (initial open + when switching contacts).
  const fetchThreadFull = useCallback(async (contact, lineId) => {
    try {
      const r = await fetch(`/api/sms/thread?contact=${encodeURIComponent(contact)}&line=${encodeURIComponent(lineId)}`);
      if (r.status === 401) { router.replace('/login'); return; }
      const d = await r.json();
      setThread(d);
      const msgs = d?.messages || [];
      lastMessageAtRef.current = msgs.length ? msgs[msgs.length - 1].created_at : null;
    } catch (e) {
      console.error(e);
    }
  }, [router]);

  // Incremental poll: only fetch new messages since the newest one we have.
  // Falls back to a full fetch if we don't have any anchor yet.
  const pollThread = useCallback(async (contact, lineId) => {
    if (!lastMessageAtRef.current) return fetchThreadFull(contact, lineId);
    try {
      const since = encodeURIComponent(lastMessageAtRef.current);
      const r = await fetch(`/api/sms/thread?contact=${encodeURIComponent(contact)}&line=${encodeURIComponent(lineId)}&since=${since}`);
      if (r.status === 401) { router.replace('/login'); return; }
      const d = await r.json();
      const newMsgs = d?.messages || [];
      if (!newMsgs.length) return;
      setThread((prev) => {
        if (!prev) return d;
        // Dedup by id — defense in depth in case the server ever re-returns a
        // row we already have (e.g. timestamp-precision bug in `?since=`).
        const seen = new Set(prev.messages.map((m) => m.id));
        const fresh = newMsgs.filter((m) => !m.id || !seen.has(m.id));
        if (!fresh.length) return prev;
        return { ...prev, messages: [...prev.messages, ...fresh] };
      });
      lastMessageAtRef.current = newMsgs[newMsgs.length - 1].created_at;
      // Also drop any pending optimistic rows that match a real arrival.
      setPendingByThread((prev) => {
        const key = `${lineId}:${contact}`;
        const list = prev[key] || [];
        if (!list.length) return prev;
        const remaining = list.filter((p) =>
          !newMsgs.some((m) => m.direction === 'outbound' && m.body === p.body)
        );
        if (remaining.length === list.length) return prev;
        return { ...prev, [key]: remaining };
      });
    } catch (e) {
      console.error(e);
    }
  }, [fetchThreadFull, router]);

  // --------- polling lifecycle (visibility-aware) ----------

  // Conversations: poll every 8s when visible. Refetch immediately on focus.
  useEffect(() => {
    if (!visible) return;
    fetchConvs();
    const i = setInterval(fetchConvs, 8000);
    return () => clearInterval(i);
  }, [visible, fetchConvs]);

  // Active thread: full fetch on open, then incremental every 4s when visible.
  useEffect(() => {
    if (!active) {
      setThread(null);
      lastMessageAtRef.current = null;
      return;
    }
    fetchThreadFull(active.contact, active.line);
  }, [active, fetchThreadFull]);

  useEffect(() => {
    if (!active || !visible) return;
    const i = setInterval(() => pollThread(active.contact, active.line), 4000);
    return () => clearInterval(i);
  }, [active, visible, pollThread]);


  // --------- derived state ----------

  // Opt-outs and archived conversations each live in their own folder. Main
  // inbox hides both by default; each folder view shows only its own.
  const optedOutCount = convs.filter((c) => c.opted_out && !archivedKeys.has(c.key)).length;
  const archivedCount = convs.filter((c) => archivedKeys.has(c.key)).length;
  const filtered = convs.filter((c) => {
    const isArchived = archivedKeys.has(c.key);
    if (view === 'opted_out') {
      if (!c.opted_out || isArchived) return false;
    } else if (view === 'archive') {
      if (!isArchived) return false;
    } else { // 'inbox'
      if (c.opted_out || isArchived) return false;
    }
    if (tab !== 'all' && c.line_id !== tab) return false;
    if (unreadOnly && c.unread_count === 0) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.contact_name && c.contact_name.toLowerCase().includes(q))
      || c.contact_number.includes(q)
      || formatPhone(c.contact_number).includes(q)
      || (c.last_message && c.last_message.toLowerCase().includes(q))
    );
  });

  // --------- keyboard shortcuts ----------

  useEffect(() => {
    const isTypingTarget = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (showOptOuts) { setShowOptOuts(false); return; }
        if (showTemplates) { setShowTemplates(false); return; }
        if (showNew) { setShowNew(false); return; }
        if (active) { setActive(null); return; }
        return;
      }
      if (isTypingTarget(document.activeElement)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === 'j' || e.key === 'k') {
        if (filtered.length === 0) return;
        e.preventDefault();
        setKbIndex((cur) => {
          const start = cur < 0 ? -1 : cur;
          const delta = e.key === 'j' ? 1 : -1;
          let next = start + delta;
          if (next < 0) next = 0;
          if (next >= filtered.length) next = filtered.length - 1;
          return next;
        });
        return;
      }
      if (e.key === 'Enter' && kbIndex >= 0 && kbIndex < filtered.length) {
        e.preventDefault();
        const c = filtered[kbIndex];
        setActive({ contact: c.contact_number, line: c.line_id });
        return;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, filtered, kbIndex, showOptOuts, showTemplates, showNew]);

  // --------- scroll + focus side effects ----------

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread?.messages, pendingByThread]);
  useEffect(() => { if (active && inputRef.current) setTimeout(() => inputRef.current.focus(), 100); }, [active]);

  // Reset the keyboard-nav cursor when the filter/search/tab changes the list.
  useEffect(() => { setKbIndex(-1); }, [search, tab, unreadOnly, view]);

  // When polling discovers new inbound messages:
  //   • If the conversation is archived → auto-unarchive it (so it shows up
  //     in the inbox again). Treat it like a regular inbox arrival → chirp.
  //   • If the conversation is opted out → stay silent and leave it in the
  //     opt-out folder (we don't want STOP-ers ringing back in).
  //   • Otherwise → just chirp.
  // The first populated snapshot establishes a baseline silently.
  useEffect(() => {
    if (!convs.length) return;
    const prev = prevConvSnapshotRef.current;
    const nextSnap = new Map(convs.map((c) => [c.key, c.total_messages]));
    if (prev) {
      const toUnarchive = [];
      let shouldChirp = false;
      for (const c of convs) {
        const before = prev.get(c.key) || 0;
        const newInbound = c.total_messages > before && c.last_direction === 'inbound';
        if (!newInbound) continue;
        if (c.opted_out) continue;
        if (archivedKeys.has(c.key)) toUnarchive.push(c);
        shouldChirp = true;
      }
      if (toUnarchive.length) {
        setArchivedKeys((prevSet) => {
          const next = new Set(prevSet);
          for (const c of toUnarchive) next.delete(c.key);
          persistArchive(next);
          return next;
        });
      }
      if (shouldChirp) playNewMessageSound();
    }
    prevConvSnapshotRef.current = nextSnap;
  }, [convs, archivedKeys, playNewMessageSound, persistArchive]);

  // --------- send (optimistic) ----------

  const activeLine = active ? lineById(active.line) : null;
  const pendingKey = active ? `${active.line}:${active.contact}` : null;
  const pendingForActive = pendingKey ? (pendingByThread[pendingKey] || []) : [];

  const doSend = useCallback(async ({ contact, line, body, tempId, mediaForSend }) => {
    try {
      const r = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: contact, body, source: 'manual', line,
          mediaUrls: (mediaForSend || []).map((m) => m.url),
        }),
      });
      if (r.status === 401) { router.replace('/login'); return { ok: false, error: 'Unauthorized' }; }
      const d = await r.json();
      if (d.success) {
        // Pull the new message via incremental poll, then it'll be deduped.
        pollThread(contact, line);
        fetchConvs();
        return { ok: true };
      }
      return { ok: false, error: d.error || 'Unknown error' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [pollThread, fetchConvs, router]);

  const handleSend = async () => {
    if (!active || sending) return;
    const body = reply.trim();
    if (!body && attachments.length === 0) return;
    const tempId = 'tmp-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const key = `${active.line}:${active.contact}`;
    const mediaSnapshot = attachments.map((a) => ({
      url: a.url, contentType: a.contentType, provider: active.line, sid: null,
    }));
    const optimistic = {
      tempId, body,
      created_at: new Date().toISOString(),
      direction: 'outbound',
      contact: active.contact,
      line: active.line,
      _optimistic: true,
      _error: null,
      status: 'queued',
      id: tempId,
      source: 'manual',
      media_urls: mediaSnapshot,
    };
    setPendingByThread((prev) => ({ ...prev, [key]: [...(prev[key] || []), optimistic] }));
    setReply('');
    setAttachments([]);
    setSendError('');
    setSending(true);
    const result = await doSend({
      contact: active.contact, line: active.line, body, tempId,
      mediaForSend: attachments,
    });
    setSending(false);
    if (!result.ok) {
      setSendError(result.error || 'Unknown error');
      setPendingByThread((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((p) => p.tempId === tempId ? { ...p, _error: result.error || 'failed' } : p),
      }));
    }
  };

  const handleRetry = async (failedMsg) => {
    const key = `${failedMsg.line}:${failedMsg.contact}`;
    setPendingByThread((prev) => ({
      ...prev,
      [key]: (prev[key] || []).map((p) => p.tempId === failedMsg.tempId ? { ...p, _error: null } : p),
    }));
    setSending(true);
    const result = await doSend({
      contact: failedMsg.contact, line: failedMsg.line,
      body: failedMsg.body, tempId: failedMsg.tempId,
      mediaForSend: failedMsg.media_urls || [],
    });
    setSending(false);
    if (!result.ok) {
      setPendingByThread((prev) => ({
        ...prev,
        [key]: (prev[key] || []).map((p) => p.tempId === failedMsg.tempId ? { ...p, _error: result.error || 'failed' } : p),
      }));
    }
  };

  const handleNew = () => {
    if (!newNum.trim()) return;
    let n = newNum.replace(/[^0-9+]/g, '');
    if (!n.startsWith('+')) {
      if (n.startsWith('1') && n.length === 11) n = '+' + n;
      else if (n.length === 10) n = '+1' + n;
      else { alert('Invalid number'); return; }
    }
    setActive({ contact: n, line: newLine });
    setShowNew(false);
    setNewNum('');
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    router.replace('/login');
  };

  // Archive helpers — pure client-side, no API. Archive state lives in
  // localStorage via persistArchive. Archived convs are hidden from the main
  // inbox but still readable in the Archive folder.
  const archiveMany = useCallback((convsToArchive) => {
    if (!convsToArchive.length) return;
    setArchivedKeys((prev) => {
      const next = new Set(prev);
      for (const c of convsToArchive) next.add(c.key);
      persistArchive(next);
      return next;
    });
    if (active && convsToArchive.some((c) => c.contact_number === active.contact && c.line_id === active.line)) {
      setActive(null);
    }
  }, [active, persistArchive]);

  const unarchiveMany = useCallback((convsToRestore) => {
    if (!convsToRestore.length) return;
    setArchivedKeys((prev) => {
      const next = new Set(prev);
      for (const c of convsToRestore) next.delete(c.key);
      persistArchive(next);
      return next;
    });
  }, [persistArchive]);

  // Bulk-delete a list of conversations in one API call. Used by the
  // "Delete all opted-out" button in the Opted out folder.
  const deleteManyConvs = useCallback(async (convsToDelete) => {
    if (!convsToDelete.length) return;
    const keys = new Set(convsToDelete.map((c) => c.key));
    setConvs((prev) => prev.filter((c) => !keys.has(c.key)));
    if (active && convsToDelete.some((c) => c.contact_number === active.contact && c.line_id === active.line)) {
      setActive(null);
    }
    try {
      const r = await fetch('/api/sms/delete-many', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairs: convsToDelete.map((c) => ({ contact: c.contact_number, line: c.line_id })),
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(`Bulk delete failed: ${err.error || r.status}`);
      }
    } catch (e) {
      alert(`Bulk delete failed: ${e.message}`);
    } finally {
      fetchConvs();
    }
  }, [active, fetchConvs]);

  // Hard-delete a conversation (all its sms_messages rows). The ✕ button on
  // each ConvItem calls this after a confirm() prompt.
  const deleteConv = useCallback(async (conv) => {
    // Optimistically remove from the inbox so it doesn't sit there during the
    // network round-trip. fetchConvs() at the end re-syncs from the server.
    setConvs((prev) => prev.filter((c) => c.key !== conv.key));
    if (active && active.contact === conv.contact_number && active.line === conv.line_id) {
      setActive(null);
    }
    try {
      const r = await fetch('/api/sms/delete-thread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact: conv.contact_number, line: conv.line_id }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        alert(`Could not delete: ${err.error || r.status}`);
      }
    } catch (e) {
      alert(`Could not delete: ${e.message}`);
    } finally {
      fetchConvs();
    }
  }, [active, fetchConvs]);


  const totals = LINES.reduce((acc, l) => {
    const lineConvs = convs.filter((c) => c.line_id === l.id);
    acc[l.id] = {
      count: lineConvs.length,
      unread: lineConvs.reduce((s, c) => s + c.unread_count, 0),
    };
    return acc;
  }, {});
  const totalUnread = convs.reduce((s, c) => s + c.unread_count, 0);

  // Merge real thread messages + pending optimistic ones for the active thread.
  const mergedThreadMessages = useMemo(() => {
    const real = thread?.messages || [];
    if (!pendingForActive.length) return real;
    return [...real, ...pendingForActive];
  }, [thread?.messages, pendingForActive]);

  // --------- responsive view selection ----------

  // Desktop: always show both panes. Mobile: list OR thread, not both.
  const showListPane = !isNarrow || !active;
  const showThreadPane = !isNarrow || !!active;

  return (
    <>
      <Head>
        <title>ADEX SMS Hub {totalUnread > 0 ? '(' + totalUnread + ')' : ''}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        {showListPane && (
          <div style={{
            width: isNarrow ? '100%' : 400,
            flexShrink: 0,
            borderRight: isNarrow ? 'none' : '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            background: 'var(--bg-secondary)',
          }}>
            <div style={{ padding: '18px 16px 0', background: 'var(--bg-primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.01em' }}>
                    ADEX<span style={{ color: 'var(--accent)' }}>.</span> SMS Hub
                  </h1>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {convs.length} conversations
                    {totalUnread > 0 && (
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        {' · ' + totalUnread + ' unread'}
                      </span>
                    )}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button onClick={() => setShowNew(!showNew)} style={{
                    background: 'var(--accent)', color: '#000', border: 'none',
                    borderRadius: 8, padding: '8px 14px', fontSize: 13,
                    fontWeight: 600, cursor: 'pointer',
                  }}>+ New</button>
                  <button onClick={() => setShowOptOuts(true)} title="Opted-out contacts" style={{
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 8, padding: '8px 10px', fontSize: 12,
                    cursor: 'pointer',
                  }}>⊘</button>
                  <button
                    onClick={() => {
                      setSoundOn((v) => {
                        const next = !v;
                        try { window.localStorage.setItem('adex_sms_sound', next ? 'on' : 'off'); } catch {}
                        // Resume audio context on user gesture if needed, then chirp once
                        // so the user hears what they just turned on.
                        if (next) {
                          try {
                            if (!audioCtxRef.current) {
                              const Ctx = window.AudioContext || window.webkitAudioContext;
                              if (Ctx) audioCtxRef.current = new Ctx();
                            }
                            if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
                              audioCtxRef.current.resume();
                            }
                          } catch {}
                          setTimeout(playNewMessageSound, 50);
                        }
                        return next;
                      });
                    }}
                    title={soundOn ? 'New-message sound is on (click to mute)' : 'New-message sound is muted (click to unmute)'}
                    style={{
                      background: 'transparent',
                      color: soundOn ? 'var(--accent)' : 'var(--text-muted)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 8, padding: '8px 10px', fontSize: 12,
                      cursor: 'pointer',
                    }}>{soundOn ? '🔔' : '🔕'}</button>
                  <button onClick={handleLogout} title="Sign out" style={{
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 8, padding: '8px 10px', fontSize: 12,
                    cursor: 'pointer',
                  }}>↪</button>
                </div>
              </div>
              {showNew && (
                <div style={{ marginBottom: 12, animation: 'fadeIn 0.2s ease' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {LINES.map((l) => {
                      const sel = newLine === l.id;
                      return (
                        <button key={l.id} onClick={() => setNewLine(l.id)} style={{
                          flex: 1, padding: '6px 10px', fontSize: 12, fontWeight: 600,
                          borderRadius: 6, cursor: 'pointer',
                          border: `1px solid ${sel ? l.color : 'var(--border-light)'}`,
                          background: sel ? `${l.color}1a` : 'var(--bg-tertiary)',
                          color: sel ? l.color : 'var(--text-secondary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}>
                          <LineDot color={l.color} size={7} />
                          Send from {l.label}
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="text" placeholder="Phone number..." value={newNum}
                      onChange={(e) => setNewNum(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleNew()}
                      style={{
                        flex: 1, padding: '8px 12px', borderRadius: 6,
                        border: '1px solid var(--border-light)',
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                      }} />
                    <button onClick={handleNew} style={{
                      background: 'var(--accent)', color: '#000', border: 'none',
                      borderRadius: 6, padding: '8px 14px', fontSize: 13,
                      fontWeight: 600, cursor: 'pointer',
                    }}>Open</button>
                  </div>
                </div>
              )}
              <input ref={searchRef} type="text" placeholder="Search conversations... (press /)" value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%', padding: '9px 12px', borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  marginBottom: 14,
                }} />
              <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
                <TabButton label="All" count={convs.length} unread={totalUnread}
                  active={tab === 'all'} onClick={() => setTab('all')} />
                {LINES.map((l) => (
                  <TabButton key={l.id} label={l.label} color={l.color}
                    count={totals[l.id]?.count || 0} unread={totals[l.id]?.unread || 0}
                    active={tab === l.id} onClick={() => setTab(l.id)} />
                ))}
              </div>
            </div>
            <div style={{
              padding: '8px 16px', display: 'flex', gap: 8, alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-primary)',
              flexWrap: 'wrap',
            }}>
              {(view === 'opted_out' || view === 'archive') ? (
                <>
                  <button onClick={() => { setView('inbox'); setActive(null); }} style={{
                    background: 'var(--bg-tertiary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 999, padding: '4px 10px', fontSize: 11,
                    fontWeight: 600, cursor: 'pointer',
                  }} title="Return to main inbox">
                    ← Back to inbox
                  </button>
                  {view === 'opted_out' && filtered.length > 0 && (
                    <button onClick={() => {
                      const n = filtered.length;
                      if (window.confirm(
                        `Permanently delete all ${n} opted-out conversations?\n\n` +
                        `This removes every message in these threads from the database. ` +
                        `It will NOT change opt-out flags on the contacts themselves — ` +
                        `they'll stay opted out and won't be texted again. Cannot be undone.`
                      )) {
                        deleteManyConvs(filtered);
                      }
                    }} style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      borderRadius: 999, padding: '4px 10px', fontSize: 11,
                      fontWeight: 600, cursor: 'pointer',
                    }} title="Hard-delete every conversation currently in the Opted out folder">
                      🗑 Delete all {filtered.length}
                    </button>
                  )}
                  {view === 'archive' && filtered.length > 0 && (
                    <button onClick={() => unarchiveMany(filtered)} style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 999, padding: '4px 10px', fontSize: 11,
                      fontWeight: 600, cursor: 'pointer',
                    }} title="Move all archived conversations back to the inbox">
                      📥 Restore all {filtered.length}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={() => setUnreadOnly((v) => !v)} style={{
                    background: unreadOnly ? 'var(--accent)' : 'var(--bg-tertiary)',
                    color: unreadOnly ? '#000' : 'var(--text-secondary)',
                    border: '1px solid ' + (unreadOnly ? 'var(--accent)' : 'var(--border-light)'),
                    borderRadius: 999, padding: '4px 10px', fontSize: 11,
                    fontWeight: 600, cursor: 'pointer',
                  }}>
                    {unreadOnly ? '● Unread only' : 'Unread only'}
                  </button>
                  {filtered.length > 0 && (
                    <button onClick={() => {
                      const n = filtered.length;
                      if (window.confirm(
                        `Move all ${n} visible inbox conversations into the Archive folder?\n\n` +
                        `They'll be hidden from the main inbox but still readable in 📁 Archive. ` +
                        `Nothing is deleted — you can restore them anytime.`
                      )) {
                        archiveMany(filtered);
                      }
                    }} style={{
                      background: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      border: '1px solid var(--border-light)',
                      borderRadius: 999, padding: '4px 10px', fontSize: 11,
                      fontWeight: 600, cursor: 'pointer',
                    }} title="Move every conversation currently visible in the inbox into the Archive folder">
                      📁 Archive all {filtered.length}
                    </button>
                  )}
                </>
              )}
              {view === 'inbox' && optedOutCount > 0 && (
                <button onClick={() => { setView('opted_out'); setActive(null); }} style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 999, padding: '4px 10px', fontSize: 11,
                  fontWeight: 600, cursor: 'pointer',
                }} title="View conversations from numbers that have opted out">
                  📭 Opted out · {optedOutCount}
                </button>
              )}
              {view === 'inbox' && archivedCount > 0 && (
                <button onClick={() => { setView('archive'); setActive(null); }} style={{
                  background: 'var(--bg-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 999, padding: '4px 10px', fontSize: 11,
                  fontWeight: 600, cursor: 'pointer',
                }} title="View archived conversations">
                  📁 Archive · {archivedCount}
                </button>
              )}
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {filtered.length} shown
                {view === 'opted_out' && ' (opt-outs only)'}
                {view === 'archive' && ' (archived only)'}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <div style={{ animation: 'pulse 1.5s infinite' }}>Loading...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                  {search ? 'No matches' : 'No conversations yet'}
                </div>
              ) : filtered.map((c, idx) => (
                <div key={c.key} style={{
                  outline: idx === kbIndex ? '2px solid var(--accent)' : 'none',
                  outlineOffset: -2,
                }}>
                  <ConvItem conv={c}
                    isActive={active?.contact === c.contact_number && active?.line === c.line_id}
                    onClick={() => setActive({ contact: c.contact_number, line: c.line_id })}
                    onDelete={deleteConv} />
                </div>
              ))}
            </div>
          </div>
        )}
        {showThreadPane && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', minWidth: 0 }}>
            {!active ? (
              <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)',
              }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>💬</div>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Select a conversation</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>or start a new one</div>
              </div>
            ) : (
              <>
                <div style={{
                  padding: '14px 20px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {isNarrow && (
                      <button onClick={() => { setActive(null); }} aria-label="Back" style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text-secondary)', fontSize: 22, padding: '0 4px',
                        lineHeight: 1,
                      }}>‹</button>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 16, fontWeight: 600, color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {thread?.contact_name || formatPhone(active.contact)}
                      </div>
                      <div style={{
                        fontSize: 12, color: 'var(--text-muted)', marginTop: 4,
                        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                      }}>
                        <span>{formatPhone(active.contact)}</span>
                        {thread?.contact_email && <span>{'· ' + thread.contact_email}</span>}
                        {thread?.messages && <span>{'· ' + thread.messages.length + ' messages'}</span>}
                        {activeLine && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 6,
                            padding: '2px 8px', borderRadius: 12,
                            background: `${activeLine.color}1a`, color: activeLine.color,
                            fontWeight: 600, fontSize: 11,
                          }}>
                            <LineDot color={activeLine.color} size={7} />
                            {activeLine.label} · {formatPhone(activeLine.number)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isNarrow && (
                    <button onClick={() => { setActive(null); }} style={{
                      background: 'none', border: '1px solid var(--border)',
                      color: 'var(--text-secondary)', borderRadius: 6,
                      padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                      flexShrink: 0,
                    }}>Close</button>
                  )}
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {mergedThreadMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 14 }}>
                      No messages yet. Send the first one below.
                    </div>
                  ) : mergedThreadMessages.map((m) => (
                    <MsgBubble
                      key={m.tempId || m.id}
                      msg={m}
                      lineColor={activeLine?.color || LINES[0].color}
                      onRetry={handleRetry}
                    />
                  ))}
                  <div ref={endRef} />
                </div>
                {sendError && (
                  <div style={{
                    padding: '8px 20px', background: 'rgba(239,68,68,0.12)',
                    borderTop: '1px solid rgba(239,68,68,0.3)',
                    color: 'var(--red)', fontSize: 12,
                  }}>{sendError}</div>
                )}
                <div style={{
                  padding: '12px 20px', borderTop: '1px solid var(--border)',
                  background: 'var(--bg-secondary)',
                  display: 'flex', gap: 10, alignItems: 'flex-end',
                  position: 'relative',
                }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      onClick={() => setShowTemplates((v) => !v)}
                      title="Templates"
                      style={{
                        background: 'var(--bg-tertiary)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-light)',
                        borderRadius: 10, padding: '10px 12px',
                        fontSize: 14, cursor: 'pointer', lineHeight: 1,
                      }}>≡</button>
                    {showTemplates && (
                      <TemplatesMenu
                        onInsert={(text) => {
                          setReply((cur) => (cur ? cur + (cur.endsWith(' ') ? '' : ' ') + text : text));
                          setTimeout(() => inputRef.current?.focus(), 0);
                        }}
                        onClose={() => setShowTemplates(false)}
                      />
                    )}
                  </div>
                  <MediaComposer
                    attachments={attachments}
                    onChange={setAttachments}
                    disabled={sending}
                  />
                  <textarea ref={inputRef} value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Reply via ${activeLine?.label || ''}... (Enter to send)`}
                    rows={1}
                    style={{
                      flex: 1, padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border-light)',
                      background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                      fontSize: 14, outline: 'none', resize: 'none',
                      fontFamily: 'inherit', lineHeight: 1.4,
                      maxHeight: 120, overflowY: 'auto',
                    }}
                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }} />
                  <button onClick={handleSend}
                    disabled={sending || (!reply.trim() && attachments.length === 0)}
                    style={{
                      background: (reply.trim() || attachments.length) ? (activeLine?.color || 'var(--accent)') : 'var(--bg-tertiary)',
                      color: (reply.trim() || attachments.length) ? '#000' : 'var(--text-muted)',
                      border: 'none', borderRadius: 10, padding: '10px 20px',
                      fontSize: 14, fontWeight: 600,
                      cursor: (reply.trim() || attachments.length) ? 'pointer' : 'default',
                      opacity: sending ? 0.6 : 1, flexShrink: 0,
                    }}>
                    {sending ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <OptOutsModal
        open={showOptOuts}
        onClose={() => setShowOptOuts(false)}
        on401={() => router.replace('/login')}
      />
    </>
  );
}
