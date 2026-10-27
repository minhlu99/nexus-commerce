import { valkey } from "@nexus/kv";
import type { MiddlewareHandler } from "hono";

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
}

/**
 * Sliding-window rate limiter powered by Valkey 9.1
 * Protects CPU/memory-intensive endpoints (e.g. scrypt password hashing on auth)
 * from thread pool saturation and denial-of-service login bursts.
 */
export function slidingWindowRateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const { windowSeconds, maxRequests, keyPrefix = "rl" } = options;

  return async (c, next) => {
    // Only rate-limit write actions (e.g. login POST, register POST)
    if (c.req.method !== "POST") {
      return await next();
    }

    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
      c.req.header("x-real-ip") ||
      "127.0.0.1";

    const path = c.req.path;
    const now = Date.now();
    const clearBefore = now - windowSeconds * 1000;
    const key = `${keyPrefix}:${path}:${ip}`;

    try {
      // Valkey multi-transaction: remove expired timestamps, add current, count remaining
      const multi = valkey.multi();
      multi.zremrangebyscore(key, 0, clearBefore);
      multi.zadd(key, now, `${now}-${Math.random()}`);
      multi.zcard(key);
      multi.expire(key, windowSeconds);

      const results = await multi.exec();
      const currentCount = (results?.[2]?.[1] as number) || 0;

      c.res.headers.set("X-RateLimit-Limit", maxRequests.toString());
      c.res.headers.set(
        "X-RateLimit-Remaining",
        Math.max(0, maxRequests - currentCount).toString(),
      );

      if (currentCount > maxRequests) {
        c.res.headers.set("Retry-After", windowSeconds.toString());
        return c.json(
          {
            error: "Too Many Requests",
            message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowSeconds}s allowed to protect server capacity.`,
          },
          429,
        );
      }
    } catch (err) {
      // Fail open if Valkey is unreachable so valid traffic is never hard-blocked
      console.warn("[RateLimiter] Valkey check failed, failing open:", err);
    }

    return await next();
  };
}
