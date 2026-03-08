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

// Awaited but race against a 500ms timeout — login is never blocked long
async function logSession(username: string, session_id: string): Promise<void> {
  const url = `${process.env.SUPABASE_URL}/rest/v1/user_sessions`;
  const now = new Date().toISOString();

  const insert = fetch(url, {
    method:  'POST',
    headers: supabaseHeaders(),
    body:    JSON.stringify({ session_id, username, logged_in_at: now, last_active_at: now }),
  }).then(res => {
    if (!res.ok) res.text().then(t => console.error('[auth/login] insert failed:', t));
  }).catch(err => console.error('[auth/login] insert error:', err));

  const timeout = new Promise<void>(resolve => setTimeout(resolve, 500));
  await Promise.race([insert, timeout]);
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

  const sessionId = crypto.randomUUID();

  // Await with 500ms timeout — never blocks login more than half a second
  await logSession(username, sessionId);

  const cookieValue = `${username}:${sessionId}`;
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
