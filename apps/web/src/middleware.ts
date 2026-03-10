// middleware.ts → apps/web/src/middleware.ts
//
// Name-only gate for personal-use EODHD compliance.
// Cookie stores "username:sessionId" — set on login.

import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, parseSessionCookie } from './lib/auth';

const LOGIN_PATH   = '/login';

// Routes that bypass the gate
const PUBLIC_PATHS = [LOGIN_PATH, '/api/auth/login', '/api/auth/heartbeat', '/api/auth/logout'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals
  if (pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  const cookieValue = request.cookies.get(COOKIE_NAME)?.value;
  const session     = parseSessionCookie(cookieValue);

  if (session) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to login preserving destination
  const loginUrl = new URL(LOGIN_PATH, request.url);
  loginUrl.searchParams.set('redirect', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
