// apps/web/src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, COOKIE_NAME, COOKIE_MAX_AGE } from '../../../../lib/auth';

function supabaseHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
    'Prefer':        'return=representation',
  };
}

// Fire-and-forget — never awaited, never blocks login
function logSession(username: string, session_id: string): void {
  const url = `${process.env.SUPABASE_URL}/rest/v1/user_sessions`;
  const now = new Date().toISOString();
  fetch(url, {
    method:  'POST',
    headers: supabaseHeaders(),
    body:    JSON.stringify({ session_id, username, logged_in_at: now, last_active_at: now }),
  }).then(res => {
    if (!res.ok) res.text().then(t => console.error('[auth/login] session insert failed:', t));
  }).catch(err => console.error('[auth/login] session insert error:', err));
}

export function GET(request: NextRequest) {
  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const session     = parseSessionCookie(cookieValue);
  if (session) {
    return NextResponse.json({ authenticated: true, username: session.username });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const user1Password = process.env.USER1_PASSWORD;
  const user2Password = process.env.USER2_PASSWORD;

  if (!user1Password || !user2Password) {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 500 });
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  await new Promise(r => setTimeout(r, 400));

  let username: string | null = null;
  if (body.password === user1Password)      username = 'user1';
  else if (body.password === user2Password) username = 'user2';

  if (!username) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // Generate session ID here — used in both cookie and Supabase log
  const sessionId   = crypto.randomUUID();
  const cookieValue = `${username}:${sessionId}`;

  // Log to Supabase — fire and forget, never blocks login
  logSession(username, sessionId);

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
