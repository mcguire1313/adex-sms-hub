import { useRef, useState } from 'react';
import { uploadMedia } from '../lib/uploadMedia';

// Renders:
//   - a row of thumbnails for already-attached files (with an 'x' to remove)
//   - a paperclip button that opens a file picker
//   - inline error message if an upload fails
//
// `attachments` is a list of { url, contentType } objects controlled by the
// parent. We never hold our own "selected file" state — once a file is picked
// it's immediately uploaded; on success it goes into the parent's attachments
// list; on failure we surface an error and the parent's list is unchanged.

export default function MediaComposer({ attachments, onChange, disabled }) {
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const remove = (idx) => {
    const next = attachments.filter((_, i) => i !== idx);
    onChange(next);
  };

  const upload = async (files) => {
    if (!files || !files.length) return;
    setError('');
    setUploading(true);
    try {
      const results = [];
      for (const f of files) {
        // eslint-disable-next-line no-await-in-loop
        const meta = await uploadMedia(f);
        results.push(meta);
      }
      onChange([...attachments, ...results]);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        title="Attach a photo or video"
        style={{
          background: 'var(--bg-tertiary)',
          color: uploading ? 'var(--accent)' : 'var(--text-secondary)',
          border: '1px solid var(--border-light)',
          borderRadius: 10, padding: '10px 12px',
          fontSize: 14, cursor: 'pointer', lineHeight: 1,
          opacity: disabled ? 0.5 : 1,
          flexShrink: 0,
        }}>
        {uploading ? '⏳' : '📎'}
      </button>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,video/mp4,video/quicktime"
        style={{ display: 'none' }}
        onChange={(e) => upload(Array.from(e.target.files || []))}
      />
      {(attachments.length > 0 || error) && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 12, right: 12,
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-light)',
          borderRadius: 8, padding: 8,
          display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start',
        }}>
          {attachments.map((a, i) => (
            <div key={i} style={{
              position: 'relative', width: 64, height: 64,
              borderRadius: 6, overflow: 'hidden',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}>
              {a.contentType && a.contentType.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-muted)', fontSize: 22,
                }}>🎬</div>
              )}
              <button
                onClick={() => remove(i)}
                aria-label="Remove attachment"
                style={{
                  position: 'absolute', top: 2, right: 2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.7)', color: '#fff',
                  border: 'none', cursor: 'pointer', fontSize: 11,
                  lineHeight: '18px', padding: 0,
                }}>×</button>
            </div>
          ))}
          {error && (
            <div style={{
              flex: 1, minWidth: 100, alignSelf: 'center',
              fontSize: 11, color: 'var(--red)',
            }}>{error}</div>
          )}
        </div>
      )}
    </>
  );
}
