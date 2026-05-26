import { NextResponse } from 'next/server';
import { sessionCookieName, verifySessionValue } from './lib/session';

// Routes that bypass the auth gate.
// - /login        : the login form itself
// - /api/auth/*   : login/logout endpoints
// - /api/webhook/*: called by Twilio / OpenPhone, secured by their own
//                   signature verification, not by our cookie.
// - /_next, etc.  : framework assets.
const PUBLIC_PREFIXES = ['/api/auth/', '/api/webhook/'];
const PUBLIC_FILE = /\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|map|txt)$/;

function isPublic(pathname) {
  if (pathname === '/login') return true;
  if (PUBLIC_FILE.test(pathname)) return true;
  if (pathname.startsWith('/_next/')) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

function timingSafeEqualStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

// Accept either:
//   - the signed session cookie set by /api/auth/login, OR
//   - `Authorization: Bearer <API_AUTH_TOKEN>` for server-to-server callers
//     (e.g. the Python recruiter sidecar).
async function isAuthenticated(req) {
  const apiToken = process.env.API_AUTH_TOKEN;
  if (apiToken) {
    const auth = req.headers.get('authorization') || '';
    if (auth.startsWith('Bearer ')) {
      if (timingSafeEqualStr(auth.slice(7), apiToken)) return true;
    }
  }
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const cookie = req.cookies.get(sessionCookieName())?.value;
  return await verifySessionValue(cookie, secret);
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const secret = process.env.SESSION_SECRET;
  const apiToken = process.env.API_AUTH_TOKEN;

  // If NOTHING is configured, fail closed for UI routes but explain why.
  if (!secret && !apiToken) {
    if (pathname.startsWith('/api/')) {
      return new NextResponse(
        JSON.stringify({ error: 'SESSION_SECRET / API_AUTH_TOKEN not configured on server' }),
        { status: 500, headers: { 'content-type': 'application/json' } }
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('e', 'config');
    return NextResponse.redirect(url);
  }

  if (await isAuthenticated(req)) return NextResponse.next();

  if (pathname.startsWith('/api/')) {
    return new NextResponse(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } }
    );
  }

  const url = req.nextUrl.clone();
  url.pathname = '/login';
  if (pathname !== '/') url.searchParams.set('next', pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
