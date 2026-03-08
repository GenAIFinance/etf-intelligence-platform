// apps/web/src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { parseSessionCookie, COOKIE_NAME, COOKIE_MAX_AGE } from '../../../../lib/auth';

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

  const sessionId   = crypto.randomUUID();
  const cookieValue = `${username}:${sessionId}`;

  const response = NextResponse.json({ authenticated: true, username });

  // Auth cookie — httpOnly, secure
  response.cookies.set(COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure:   true,
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });

  // Username cookie — readable by JS so axios can attach x-username header
  response.cookies.set('etf_user', username, {
    httpOnly: false,
    secure:   true,
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });

  return response;
}
