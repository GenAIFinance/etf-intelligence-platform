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
  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name || name.length < 1) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  }
  if (name.length > 50) {
    return NextResponse.json({ error: 'Name must be under 50 characters' }, { status: 400 });
  }

  const username    = name;
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

  // Session ID cookie — readable by JS for session tracking
  response.cookies.set('etf_session', sessionId, {
    httpOnly: false,
    secure:   true,
    sameSite: 'lax',
    maxAge:   COOKIE_MAX_AGE,
    path:     '/',
  });

  return response;
}
