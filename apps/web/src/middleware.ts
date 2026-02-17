import { NextRequest, NextResponse } from 'next/server';

// ─── User credentials ───────────────────────────────────────────────
// Add up to 3 users here (username:password pairs)
// These are loaded from env vars for security. Format: "user1:pass1,user2:pass2"
// OR you can hardcode them below as a fallback.
function getAuthorizedUsers(): Record<string, string> {
  const envUsers = process.env.AUTH_USERS;
  if (envUsers) {
    const users: Record<string, string> = {};
    envUsers.split(',').forEach((pair) => {
      const [username, ...passParts] = pair.trim().split(':');
      const password = passParts.join(':'); // handle passwords with colons
      if (username && password) users[username] = password;
    });
    return users;
  }

  // Fallback: hardcoded users (only used if AUTH_USERS env var not set)
  // CHANGE THESE before deploying!
  return {
    admin: process.env.AUTH_PASSWORD || 'etf2026!',
  };
}

// ─── Auth checker ────────────────────────────────────────────────────
function isAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Basic ')) return false;

  const base64 = authHeader.slice(6);
  const decoded = Buffer.from(base64, 'base64').toString('utf-8');
  const colonIndex = decoded.indexOf(':');
  if (colonIndex === -1) return false;

  const username = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  const authorizedUsers = getAuthorizedUsers();
  return authorizedUsers[username] === password;
}

// ─── Middleware ───────────────────────────────────────────────────────
export function middleware(request: NextRequest) {
  // Skip auth for static assets and Next.js internals
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt')
  ) {
    return NextResponse.next();
  }

  if (isAuthenticated(request)) {
    return NextResponse.next();
  }

  // Return 401 with WWW-Authenticate header → triggers browser login dialog
  return new NextResponse('Authentication required', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="ETF Intelligence Platform", charset="UTF-8"',
    },
  });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
