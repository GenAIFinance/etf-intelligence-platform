// apps/web/src/app/api/auth/login/route.ts
//
// POST — validate password against USER1_PASSWORD / USER2_PASSWORD,
//         create session row in Supabase, set cookie "username:sessionId"
// GET  — check if current cookie is valid (used by login page on mount)

import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, COOKIE_NAME } from '../../../../middleware';

const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// ── Supabase REST helpers ────────────────────────────────────────────────────
// Uses the service-role key (server-side only — never expose to browser).

function supabaseHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
    'Prefer':        'return=representation',
  };
}

async function createSession(username: string): Promise<string | null> {
  const url = `${process.env.SUPABASE_URL}/rest/v1/user_sessions`;
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: supabaseHeaders(),
      body:    JSON.stringify({ username }),
    });
    if (!res.ok) {
      console.error('[auth/login] Supabase insert failed:', await res.text());
      return null;
    }
    const rows = await res.json();
    return rows?.[0]?.session_id ?? null;
  } catch (err) {
    console.error('[auth/login] Supabase error:', err);
    return null;
  }
}

// ── Route handlers ───────────────────────────────────────────────────────────

// GET — check if already authenticated (used by login page on mount)
export function GET(request: NextRequest) {
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const session     = parseSessionCookie(cookieValue);
  if (session) {
    return NextResponse.json({ authenticated: true, username: session.username });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

// POST — validate password, create session, set cookie
export async function POST(request: NextRequest) {
  const user1Password = process.env.USER1_PASSWORD;
  const user2Password = process.env.USER2_PASSWORD;

  if (!user1Password || !user2Password) {
    console.error('[auth/login] USER1_PASSWORD / USER2_PASSWORD not configured');
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  // Small constant-time delay regardless of outcome
  await new Promise(r => setTimeout(r, 400));

  let username: string | null = null;
  if (body.password === user1Password)      username = 'user1';
  else if (body.password === user2Password) username = 'user2';

  if (!username) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // Log session to Supabase — failure does not block login
  const sessionId = await createSession(username);
  if (!sessionId) {
    console.warn('[auth/login] Session logging failed — login still proceeding');
  }

  // Cookie: "username:sessionId" — sessionId needed for heartbeat updates
  const cookieValue = `${username}:${sessionId ?? crypto.randomUUID()}`;

  const response = NextResponse.json({ authenticated: true, username });
  response.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });

  return response;
}
