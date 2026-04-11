// apps/web/src/app/api/auth/invite/[token]/route.ts
//
// GET /api/auth/invite/:token
//
// Validates the invite token against Supabase, marks it used,
// sets the same 3 auth cookies as the login route, then
// redirects the user to the dashboard — zero friction, one click.

import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE    = 'etf_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ── Supabase REST helper — no SDK needed in Next.js edge-compatible route ──
async function supabaseFetch(path: string, options: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase env vars not set in Vercel');
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'Content-Type':  'application/json',
      'apikey':        SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      ...(options.headers ?? {}),
    },
  });
  return res;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const { token } = params;

  if (!token || token.length < 10) {
    return NextResponse.redirect(new URL('/login?error=invalid', request.url));
  }

  // ── Look up the token ────────────────────────────────────────────────────
  const lookupRes = await supabaseFetch(
    `/invite_tokens?token=eq.${encodeURIComponent(token)}&select=token,label,used_at,expires_at&limit=1`
  );

  if (!lookupRes.ok) {
    return NextResponse.redirect(new URL('/login?error=server', request.url));
  }

  const rows: Array<{
    token: string;
    label: string;
    used_at: string | null;
    expires_at: string;
  }> = await lookupRes.json();

  const row = rows[0];

  // ── Validate ─────────────────────────────────────────────────────────────
  if (!row) {
    return NextResponse.redirect(new URL('/login?error=invalid', request.url));
  }

  if (row.used_at) {
    return NextResponse.redirect(new URL('/login?error=used', request.url));
  }

  if (new Date(row.expires_at) < new Date()) {
    return NextResponse.redirect(new URL('/login?error=expired', request.url));
  }

  // ── Mark token as used ───────────────────────────────────────────────────
  await supabaseFetch(
    `/invite_tokens?token=eq.${encodeURIComponent(token)}`,
    {
      method:  'PATCH',
      body:    JSON.stringify({ used_at: new Date().toISOString() }),
    }
  );

  // ── Build session — label becomes the username ───────────────────────────
  // Sanitise label: trim, max 50 chars, fall back to "Guest"
  const username  = (row.label.trim().slice(0, 50)) || 'Guest';
  const sessionId = crypto.randomUUID();

  // ── Redirect to dashboard with auth cookies set ──────────────────────────
  const response = NextResponse.redirect(new URL('/', request.url));

  response.cookies.set(AUTH_COOKIE, `${username}:${sessionId}`, {
    httpOnly: true, secure: true, sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE, path: '/',
  });
  response.cookies.set('etf_user', username, {
    httpOnly: false, secure: true, sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE, path: '/',
  });
  response.cookies.set('etf_session', sessionId, {
    httpOnly: false, secure: true, sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE, path: '/',
  });

  return response;
}
