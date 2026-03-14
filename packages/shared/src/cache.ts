import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !url.startsWith("https")) return null;
  _redis = new Redis({ url, token });
  return _redis;
}

/**
 * Cache-aside helper. Returns cached value if available,
 * otherwise executes `fn`, caches the result, and returns it.
 * Gracefully falls back to `fn` if Redis is unavailable.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  if (!redis) return fn();

  try {
    const hit = await redis.get<T>(key);
    if (hit !== null && hit !== undefined) return hit;
  } catch {
    // Redis down — fall through to fn
  }

  const result = await fn();

  try {
    if (ttlSeconds > 0) {
      await redis.set(key, JSON.stringify(result), { ex: ttlSeconds });
    } else {
      await redis.set(key, JSON.stringify(result));
    }
  } catch {
    // Fire-and-forget cache write
  }

  return result;
}

/**
 * Invalidate a single cache key.
 */
export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch {
    // Best-effort
  }
}

/**
 * Invalidate all keys matching a pattern (uses SCAN, safe for production).
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    let cursor = 0;
    do {
      const [nextCursor, keys] = await redis.scan(cursor, { match: pattern, count: 100 });
      cursor = Number(nextCursor);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== 0);
  } catch {
    // Best-effort
  }
}

/**
 * Get the raw Redis client for advanced use cases (rate limiting, etc).
 */
export function getRedisClient(): Redis | null {
  return getRedis();
}

export { Redis };
