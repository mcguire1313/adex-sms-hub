// Renders the media_urls array attached to an sms_messages row.
// Twilio media URLs go through /api/media/twilio (server-side auth).
// OpenPhone media URLs are public CDN, used directly.

function resolveSrc(m) {
  if (!m || !m.url) return null;
  if (m.provider === 'twilio') {
    // Prefer messageSid+sid pair (from webhook); fall back to nothing.
    if (m.messageSid && m.sid) {
      return `/api/media/twilio?messageSid=${encodeURIComponent(m.messageSid)}&mediaSid=${encodeURIComponent(m.sid)}`;
    }
    // Older rows without parsed SIDs: try to parse from the URL.
    const match = /\/Messages\/([^/]+)\/Media\/([^/?]+)/.exec(m.url);
    if (match) {
      return `/api/media/twilio?messageSid=${encodeURIComponent(match[1])}&mediaSid=${encodeURIComponent(match[2])}`;
    }
    return null; // can't render Twilio media without auth
  }
  return m.url;
}

function isImage(ct) {
  return typeof ct === 'string' && ct.toLowerCase().startsWith('image/');
}

function isVideo(ct) {
  return typeof ct === 'string' && ct.toLowerCase().startsWith('video/');
}

export default function MediaAttachments({ media }) {
  if (!Array.isArray(media) || media.length === 0) return null;
  return (
    <div style={{
      marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      {media.map((m, i) => {
        const src = resolveSrc(m);
        if (!src) {
          return (
            <div key={i} style={{
              padding: '6px 8px', borderRadius: 6,
              background: 'var(--bg-tertiary)',
              fontSize: 11, color: 'var(--text-muted)',
            }}>
              (attachment unavailable)
            </div>
          );
        }
        if (isImage(m.contentType)) {
          return (
            // eslint-disable-next-line @next/next/no-img-element
            <a key={i} href={src} target="_blank" rel="noreferrer">
              <img
                src={src}
                alt="attachment"
                loading="lazy"
                style={{
                  maxWidth: '100%', maxHeight: 280, borderRadius: 8,
                  display: 'block', background: 'var(--bg-tertiary)',
                }}
              />
            </a>
          );
        }
        if (isVideo(m.contentType)) {
          return (
            <video
              key={i}
              src={src}
              controls
              style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8 }}
            />
          );
        }
        return (
          <a key={i} href={src} target="_blank" rel="noreferrer" style={{
            display: 'inline-block', padding: '6px 10px', borderRadius: 6,
            background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
            textDecoration: 'none', fontSize: 12,
            border: '1px solid var(--border-light)',
          }}>
            📎 attachment{m.contentType ? ` (${m.contentType})` : ''}
          </a>
        );
      })}
    </div>
  );
}
