import { valkey } from "./connection.js";

/**
 * Atomic Valkey Lua Sliding-Window Rate Limiter
 *
 * Prevents the "Immortal Key" bug (PTTL == -1) and eliminates t=0 race conditions
 * by executing window cleanup, card count, entry addition, and TTL extension atomically.
 *
 * KEYS[1]: Rate limit key
 * ARGV[1]: Current timestamp in ms
 * ARGV[2]: Window duration in ms
 * ARGV[3]: Max requests allowed
 * ARGV[4]: Unique member identifier (e.g. timestamp-random)
 *
 * Returns: [allowed: 0 | 1, currentCount: number]
 */
const ATOMIC_RATE_LIMIT_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local max_req = tonumber(ARGV[3])
local member = ARGV[4]

-- 1. Remove expired timestamps outside the sliding window
local clear_before = now - window_ms
redis.call("ZREMRANGEBYSCORE", key, 0, clear_before)

-- 2. Check current active count
local current = redis.call("ZCARD", key)

if current >= max_req then
  -- Self-healing guard: if key ever lost its TTL during a network drop, restore it
  if redis.call("PTTL", key) == -1 then
    redis.call("PEXPIRE", key, window_ms)
  end
  return { 0, current }
else
  -- 3. Atomically add current request and refresh window TTL in the same microsecond
  redis.call("ZADD", key, now, member)
  redis.call("PEXPIRE", key, window_ms)
  return { 1, current + 1 }
end
`;

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
}

export async function checkAtomicRateLimit(
  key: string,
  windowSeconds: number,
  maxRequests: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const member = `${now}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const res = (await valkey.eval(
      ATOMIC_RATE_LIMIT_LUA,
      1,
      key,
      now.toString(),
      windowMs.toString(),
      maxRequests.toString(),
      member,
    )) as [number, number];

    return {
      allowed: res[0] === 1,
      currentCount: res[1],
    };
  } catch (err) {
    console.warn(`[Valkey RateLimit] Lua execution failed for ${key}, failing open:`, err);
    return {
      allowed: true,
      currentCount: 0,
    };
  }
}
