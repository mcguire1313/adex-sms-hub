import { useEffect, useRef, useState } from 'react';
import { loadTemplates, saveTemplates, newTemplate } from '../lib/templates';

// Two modes:
//  - list (default): click a template to insert it into the compose box,
//                    Manage button switches to edit mode.
//  - edit:           inline editor with add / save / delete.

export default function TemplatesMenu({ onInsert, onClose }) {
  const [templates, setTemplates] = useState([]);
  const [mode, setMode] = useState('list');
  const popRef = useRef(null);

  useEffect(() => { setTemplates(loadTemplates()); }, []);

  // Close on click-outside.
  useEffect(() => {
    const onDoc = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) onClose?.();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const persist = (next) => {
    setTemplates(next);
    saveTemplates(next);
  };

  const addNew = () => persist([...templates, newTemplate({ label: 'New template', body: '' })]);
  const remove = (id) => persist(templates.filter((t) => t.id !== id));
  const update = (id, patch) => persist(templates.map((t) => t.id === id ? { ...t, ...patch } : t));

  return (
    <div ref={popRef} style={{
      position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
      width: 340, maxHeight: 360,
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-light)', borderRadius: 10,
      boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', zIndex: 20,
    }}>
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: 'var(--bg-primary)',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
          {mode === 'edit' ? 'Manage templates' : 'Templates'}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          {mode === 'edit' ? (
            <>
              <button onClick={addNew} style={{
                background: 'var(--accent)', color: '#000', border: 'none',
                borderRadius: 5, padding: '4px 8px', fontSize: 11,
                fontWeight: 600, cursor: 'pointer',
              }}>+ Add</button>
              <button onClick={() => setMode('list')} style={{
                background: 'transparent', color: 'var(--text-secondary)',
                border: '1px solid var(--border-light)',
                borderRadius: 5, padding: '4px 8px', fontSize: 11,
                cursor: 'pointer',
              }}>Done</button>
            </>
          ) : (
            <button onClick={() => setMode('edit')} style={{
              background: 'transparent', color: 'var(--text-secondary)',
              border: '1px solid var(--border-light)',
              borderRadius: 5, padding: '4px 8px', fontSize: 11,
              cursor: 'pointer',
            }}>Manage</button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {templates.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No templates yet.{' '}
            <button onClick={() => { setMode('edit'); addNew(); }} style={{
              background: 'none', border: 'none', padding: 0,
              color: 'var(--accent)', cursor: 'pointer', fontSize: 12,
              textDecoration: 'underline',
            }}>Add one</button>
          </div>
        ) : mode === 'edit' ? (
          templates.map((t) => (
            <div key={t.id} style={{
              padding: '10px 12px', borderBottom: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <input
                value={t.label}
                onChange={(e) => update(t.id, { label: e.target.value })}
                placeholder="Label"
                style={{
                  padding: '5px 8px', borderRadius: 5,
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                  fontSize: 12, outline: 'none',
                }}
              />
              <textarea
                value={t.body}
                onChange={(e) => update(t.id, { body: e.target.value })}
                placeholder="Message body"
                rows={2}
                style={{
                  padding: '5px 8px', borderRadius: 5, resize: 'vertical',
                  border: '1px solid var(--border-light)',
                  background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                  fontSize: 12, outline: 'none', fontFamily: 'inherit',
                }}
              />
              <button onClick={() => remove(t.id)} style={{
                background: 'none', border: 'none', padding: 0,
                color: 'var(--red)', cursor: 'pointer', fontSize: 11,
                alignSelf: 'flex-start', textDecoration: 'underline',
              }}>Delete</button>
            </div>
          ))
        ) : (
          templates.map((t) => (
            <button
              key={t.id}
              onClick={() => { onInsert(t.body); onClose?.(); }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 12px', borderBottom: '1px solid var(--border)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--text-primary)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>{t.label}</div>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{t.body}</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
