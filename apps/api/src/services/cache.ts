import { LRUCache } from 'lru-cache';
import { prisma } from '../db';

// Memory cache without type parameters to avoid strict typing issues
const memoryCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60, // 1 hour
});

export class CacheService {
  // Get from cache (memory first, then database)
  static async get<T>(key: string): Promise<T | null> {
    // Check memory cache
    const memValue = memoryCache.get(key);
    if (memValue !== undefined) {
      return memValue as T;
    }

    // Check database cache
    try {
      const dbCache = await prisma.apiCache.findUnique({ where: { key } });
      if (!dbCache) return null;

      const now = Date.now();
      const age = now - dbCache.fetchedAt.getTime();
      const ttl = dbCache.ttlSeconds * 1000;

      if (age > ttl) {
        // Expired
        await prisma.apiCache.delete({ where: { key } });
        return null;
      }

      const value = JSON.parse(dbCache.valueJson);
      memoryCache.set(key, value);
      return value as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  // Set cache (both memory and database)
  // Set cache (both memory and database)
  static async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      // Cast to any to bypass LRUCache strict typing
      memoryCache.set(key, value as any, { ttl: ttlSeconds * 1000 });

      await prisma.apiCache.upsert({
        where: { key },
        create: {
          key,
          valueJson: JSON.stringify(value),
          ttlSeconds,
        },
        update: {
          valueJson: JSON.stringify(value),
          fetchedAt: new Date(),
          ttlSeconds,
        },
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  // Clear specific key
  static async clear(key: string): Promise<void> {
    memoryCache.delete(key);
    try {
      await prisma.apiCache.delete({ where: { key } });
    } catch (error) {
      // Key might not exist, ignore
    }
  }

  // Clear all cache
  static async clearAll(): Promise<void> {
    memoryCache.clear();
    try {
      await prisma.apiCache.deleteMany({});
    } catch (error) {
      console.error('Cache clear all error:', error);
    }
  }

  // Cleanup expired entries
  static async cleanup(): Promise<void> {
    try {
      const all = await prisma.apiCache.findMany();
      const now = Date.now();

      for (const entry of all) {
        const age = now - entry.fetchedAt.getTime();
        const ttl = entry.ttlSeconds * 1000;

        if (age > ttl) {
          await prisma.apiCache.delete({ where: { id: entry.id } });
        }
      }
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  // Alias for scheduler
  static async cleanupExpired(): Promise<void> {
    await this.cleanup();
  }

  // Cache key generators
  static keys = {
    etfProfile: (ticker: string) => `etf:profile:${ticker}`,
    etfPrices: (ticker: string, from: string, to: string) => 
      `etf:prices:${ticker}:${from}:${to}`,
    news: (page: number) => `news:page:${page}`,
  };
}