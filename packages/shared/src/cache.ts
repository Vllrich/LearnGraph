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
 * Get the raw Redis client for advanced use cases (rate limiting, etc).
 * Returns null when Redis is not configured.
 */
export function getRedisClient(): Redis | null {
  return getRedis();
}
