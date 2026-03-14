import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "./cache";

type RateLimitConfig = {
  /** Max requests in the window */
  maxRequests: number;
  /** Window duration string, e.g. "60 s", "10 m" */
  window: Parameters<typeof Ratelimit.slidingWindow>[1];
};

const _limiters = new Map<string, Ratelimit>();

// In-memory fallback for when Redis is not configured
const _memoryMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Get or create a rate limiter. Uses Upstash Redis if available,
 * falls back to in-memory (per-instance) limiting.
 */
function getLimiter(name: string, config: RateLimitConfig): Ratelimit | null {
  const existing = _limiters.get(name);
  if (existing) return existing;

  const redis = getRedisClient();
  if (!redis) return null;

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.maxRequests, config.window),
    prefix: `rl:${name}`,
    analytics: true,
  });

  _limiters.set(name, limiter);
  return limiter;
}

/**
 * Check rate limit for a given identifier (usually userId).
 * Returns { allowed, retryAfterMs }.
 */
export async function checkRateLimit(
  name: string,
  identifier: string,
  config: RateLimitConfig,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const limiter = getLimiter(name, config);

  if (limiter) {
    try {
      const result = await limiter.limit(identifier);
      return {
        allowed: result.success,
        retryAfterMs: result.success ? 0 : Math.max(0, result.reset - Date.now()),
      };
    } catch {
      // Redis error — fall through to in-memory
    }
  }

  // In-memory fallback
  const windowMs = parseWindowMs(config.window);
  const key = `${name}:${identifier}`;
  const now = Date.now();
  const entry = _memoryMap.get(key);

  if (!entry || now > entry.resetAt) {
    _memoryMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

function parseWindowMs(window: string): number {
  const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
  if (!match) return 60_000;
  const [, num, unit] = match;
  const multipliers: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return parseInt(num) * (multipliers[unit] ?? 60_000);
}
