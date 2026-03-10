// apps/web/src/app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE   = 'etf_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Inlined — does NOT import from lib/auth.ts to avoid stale-deploy issues
function parseSession(value: string | undefined) {
  if (!value) return null;
  const [username, sessionId] = value.split(':');
  if (!username || !sessionId) return null;
  return { username, sessionId };
}

export function GET(request: NextRequest) {
  const session = parseSession(request.cookies.get(AUTH_COOKIE)?.value);
  if (session) return NextResponse.json({ authenticated: true, username: session.username });
  return NextResponse.json({ authenticated: false }, { status: 401 });
}

export async function POST(request: NextRequest) {
  let body: { name?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (name.length > 50) return NextResponse.json({ error: 'Name too long' }, { status: 400 });

  const sessionId = crypto.randomUUID();

  const response = NextResponse.json({ authenticated: true, username: name });

  // Gate cookie — httpOnly, read by middleware only
  response.cookies.set(AUTH_COOKIE, `${name}:${sessionId}`, {
    httpOnly: true, secure: true, sameSite: 'lax', maxAge: COOKIE_MAX_AGE, path: '/',
  });

  // JS-readable cookies for axios headers
  response.cookies.set('etf_user', name, {
    httpOnly: false, secure: true, sameSite: 'lax', maxAge: COOKIE_MAX_AGE, path: '/',
  });
  response.cookies.set('etf_session', sessionId, {
    httpOnly: false, secure: true, sameSite: 'lax', maxAge: COOKIE_MAX_AGE, path: '/',
  });

  return response;
}
