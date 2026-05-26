import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function Login() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const configError = router.query.e === 'config';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.success) {
        const next = typeof router.query.next === 'string' ? router.query.next : '/';
        router.replace(next);
      } else {
        setError(d.error || 'Login failed');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>ADEX SMS Hub — Sign in</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </Head>
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)', padding: 24,
      }}>
        <form onSubmit={handleSubmit} style={{
          width: '100%', maxWidth: 360,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)', borderRadius: 12,
          padding: 28,
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        }}>
          <h1 style={{
            fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 6,
            color: 'var(--text-primary)', letterSpacing: '-0.01em',
          }}>
            ADEX<span style={{ color: 'var(--accent)' }}>.</span> SMS Hub
          </h1>
          <p style={{
            fontSize: 13, color: 'var(--text-muted)', margin: 0, marginBottom: 20,
          }}>Sign in to continue.</p>

          {configError && (
            <div style={{
              padding: '10px 12px', borderRadius: 8, marginBottom: 14,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--red)', fontSize: 12,
            }}>
              Server is missing APP_PASSWORD or SESSION_SECRET. Set both in Vercel project env and redeploy.
            </div>
          )}

          <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            style={{
              width: '100%', padding: '10px 12px', borderRadius: 8,
              border: '1px solid var(--border-light)',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)', fontSize: 14, outline: 'none',
              marginBottom: 14,
            }}
          />

          {error && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, marginBottom: 14,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: 'var(--red)', fontSize: 12,
            }}>{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            style={{
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: 'none', cursor: password ? 'pointer' : 'default',
              background: password ? 'var(--accent)' : 'var(--bg-tertiary)',
              color: password ? '#000' : 'var(--text-muted)',
              fontWeight: 600, fontSize: 14,
              opacity: submitting ? 0.6 : 1,
            }}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </>
  );
}
