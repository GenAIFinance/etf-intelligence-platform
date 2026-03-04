// In-memory cache for AI query results
// apps/api/src/lib/cache.ts
//
// Zero dependencies — no Redis needed for MVP.
// Resets on Railway redeploy (acceptable for short-TTL AI responses).
// To upgrade to Redis later: swap cacheGet/cacheSet bodies to ioredis calls,
// keep the same interface — no other files need to change.

interface CacheEntry {
  data:    string;
  expires: number;
}

const store = new Map<string, CacheEntry>();

// ── Public API ────────────────────────────────────────────────────────────────

export function cacheGet(key: string): string | null {
  const item = store.get(key);
  if (!item) return null;
  if (item.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  return item.data;
}

export function cacheSet(key: string, value: string, ttlSeconds = 3600): void {
  store.set(key, {
    data:    value,
    expires: Date.now() + ttlSeconds * 1000,
  });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

// Normalise query string + optional context object into a stable cache key
export function makeCacheKey(query: string, context?: object): string {
  const base   = query.trim().toLowerCase().replace(/\s+/g, ' ');
  const suffix = context ? `:${JSON.stringify(context)}` : '';
  return `ai:${base}${suffix}`;
}
