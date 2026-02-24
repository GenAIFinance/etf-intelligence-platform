// middleware.ts → apps/web/src/middleware.ts
//
// Password gate for personal-use EODHD compliance.
// Supports two named users (user1 / user2) with separate passwords.
// Cookie stores "username:sessionId" — not the password itself.

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

  // Fail open in dev if no passwords configured, fail closed in prod
  if (!process.env.USER1_PASSWORD || !process.env.USER2_PASSWORD) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[middleware] USER1_PASSWORD / USER2_PASSWORD not set — blocking access');
      return NextResponse.redirect(new URL(LOGIN_PATH, request.url));
    }
    return NextResponse.next();
  }

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
