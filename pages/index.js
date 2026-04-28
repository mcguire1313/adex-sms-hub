import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { LINES, lineById } from '../lib/lines';

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

function ConvItem({ conv, isActive, onClick }) {
  const u = conv.unread_count > 0;
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '14px 16px', cursor: 'pointer',
      background: isActive ? 'var(--bg-tertiary)' : 'transparent',
      borderBottom: '1px solid var(--border)',
      borderLeft: isActive ? `3px solid ${conv.line_color}` : '3px solid transparent',
      transition: 'background 0.12s',
    }}
    onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
    onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
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
    </div>
  );
}

function MsgBubble({ msg, lineColor }) {
  const o = msg.direction === 'outbound';
  const f = msg.status === 'failed' || msg.status === 'undelivered';
  const outboundBg = f ? 'rgba(239,68,68,0.15)' : `${lineColor}1f`;
  const outboundBorder = f ? 'rgba(239,68,68,0.3)' : `${lineColor}33`;
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
      }}>
        <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
          {msg.body}
        </div>
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', marginTop: 4,
          display: 'flex', alignItems: 'center', gap: 6,
          justifyContent: o ? 'flex-end' : 'flex-start',
        }}>
          {formatTs(msg.created_at)}
          {o && (
            <span style={{ color: f ? 'var(--red)' : msg.status === 'delivered' ? 'var(--green)' : 'var(--text-muted)' }}>
              {f ? '! Failed' : msg.status === 'delivered' ? '✓✓' : '✓'}
            </span>
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

export default function SMSHub() {
  const [convs, setConvs] = useState([]);
  const [active, setActive] = useState(null);
  const [thread, setThread] = useState(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [newNum, setNewNum] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [tab, setTab] = useState('all');
  const [newLine, setNewLine] = useState(LINES[0].id);
  const [sendError, setSendError] = useState('');
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const fetchConvs = useCallback(async () => {
    try {
      const r = await fetch('/api/sms/conversations');
      const d = await r.json();
      if (d.conversations) setConvs(d.conversations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchThread = useCallback(async (contact, lineId) => {
    try {
      const r = await fetch(`/api/sms/thread?contact=${encodeURIComponent(contact)}&line=${encodeURIComponent(lineId)}`);
      setThread(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchConvs();
    const i = setInterval(fetchConvs, 15000);
    return () => clearInterval(i);
  }, [fetchConvs]);

  useEffect(() => {
    if (active) {
      fetchThread(active.contact, active.line);
      const i = setInterval(() => fetchThread(active.contact, active.line), 10000);
      return () => clearInterval(i);
    }
  }, [active, fetchThread]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [thread?.messages]);
  useEffect(() => { if (active && inputRef.current) setTimeout(() => inputRef.current.focus(), 100); }, [active]);

  const activeLine = active ? lineById(active.line) : null;

  const handleSend = async () => {
    if (!reply.trim() || !active || sending) return;
    setSendError('');
    setSending(true);
    try {
      const r = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: active.contact, body: reply.trim(), source: 'manual', line: active.line }),
      });
      const d = await r.json();
      if (d.success) {
        setReply('');
        await fetchThread(active.contact, active.line);
        await fetchConvs();
      } else {
        setSendError(d.error || 'Unknown error');
      }
    } catch (e) {
      setSendError(e.message);
    } finally {
      setSending(false);
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
    fetchThread(n, newLine);
  };

  const filtered = convs.filter((c) => {
    if (tab !== 'all' && c.line_id !== tab) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (c.contact_name && c.contact_name.toLowerCase().includes(q))
      || c.contact_number.includes(q)
      || formatPhone(c.contact_number).includes(q)
      || (c.last_message && c.last_message.toLowerCase().includes(q))
    );
  });

  const totals = LINES.reduce((acc, l) => {
    const lineConvs = convs.filter((c) => c.line_id === l.id);
    acc[l.id] = {
      count: lineConvs.length,
      unread: lineConvs.reduce((s, c) => s + c.unread_count, 0),
    };
    return acc;
  }, {});
  const totalUnread = convs.reduce((s, c) => s + c.unread_count, 0);

  return (
    <>
      <Head>
        <title>ADEX SMS Hub {totalUnread > 0 ? '(' + totalUnread + ')' : ''}</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <div style={{
          width: 400, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-secondary)',
        }}>
          <div style={{ padding: '18px 16px 0', background: 'var(--bg-primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
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
              <button onClick={() => setShowNew(!showNew)} style={{
                background: 'var(--accent)', color: '#000', border: 'none',
                borderRadius: 8, padding: '8px 14px', fontSize: 13,
                fontWeight: 600, cursor: 'pointer',
              }}>+ New</button>
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
            <input type="text" placeholder="Search conversations..." value={search}
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
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ animation: 'pulse 1.5s infinite' }}>Loading...</div>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
                {search ? 'No matches' : 'No conversations yet'}
              </div>
            ) : filtered.map((c) => (
              <ConvItem key={c.key} conv={c}
                isActive={active?.contact === c.contact_number && active?.line === c.line_id}
                onClick={() => setActive({ contact: c.contact_number, line: c.line_id })} />
            ))}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
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
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>
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
                <button onClick={() => { setActive(null); setThread(null); }} style={{
                  background: 'none', border: '1px solid var(--border)',
                  color: 'var(--text-secondary)', borderRadius: 6,
                  padding: '6px 12px', fontSize: 12, cursor: 'pointer',
                }}>Close</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                {thread?.messages?.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40, fontSize: 14 }}>
                    No messages yet. Send the first one below.
                  </div>
                ) : thread?.messages?.map((m) => (
                  <MsgBubble key={m.id} msg={m} lineColor={activeLine?.color || LINES[0].color} />
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
              }}>
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
                  disabled={sending || !reply.trim()}
                  style={{
                    background: reply.trim() ? (activeLine?.color || 'var(--accent)') : 'var(--bg-tertiary)',
                    color: reply.trim() ? '#000' : 'var(--text-muted)',
                    border: 'none', borderRadius: 10, padding: '10px 20px',
                    fontSize: 14, fontWeight: 600,
                    cursor: reply.trim() ? 'pointer' : 'default',
                    opacity: sending ? 0.6 : 1, flexShrink: 0,
                  }}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
