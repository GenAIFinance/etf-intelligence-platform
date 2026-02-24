// apps/web/src/lib/auth.ts
//
// Shared auth constants and helpers.
// Imported by both middleware.ts and the API routes to avoid
// cross-runtime import issues (Edge vs Node.js).

export const COOKIE_NAME    = 'etf_session';
export const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Parse cookie value → { username, sessionId } | null */
export function parseSessionCookie(
  value: string | undefined
): { username: string; sessionId: string } | null {
  if (!value) return null;
  const [username, sessionId] = value.split(':');
  if (!username || !sessionId) return null;
  if (username !== 'user1' && username !== 'user2') return null;
  return { username, sessionId };
}
