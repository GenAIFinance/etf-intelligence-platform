// middleware.ts → apps/web/src/middleware.ts

import { NextRequest, NextResponse } from 'next/server';

const AUTH_COOKIE  = 'etf_auth';
const LOGIN_PATH   = '/login';
const PUBLIC_PATHS = [LOGIN_PATH, '/api/auth/login', '/api/auth/heartbeat', '/api/auth/logout'];

// Inlined — does NOT import from lib/auth.ts to avoid stale-deploy issues
function isValidSession(value: string | undefined): boolean {
  if (!value) return false;
  const [username, sessionId] = value.split(':');
  return !!(username && sessionId);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') return NextResponse.next();

  const cookieValue = request.cookies.get(AUTH_COOKIE)?.value;

  if (isValidSession(cookieValue)) return NextResponse.next();

  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
