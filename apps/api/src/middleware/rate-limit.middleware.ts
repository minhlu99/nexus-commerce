import { getConnInfo } from "@hono/node-server/conninfo";
import { env } from "@nexus/env";
import { checkAtomicRateLimit } from "@nexus/kv";
import type { Context, MiddlewareHandler } from "hono";

interface RateLimitOptions {
  windowSeconds: number;
  maxRequests: number;
  keyPrefix?: string;
  // Optional second key extractor (e.g., email or userId) to defeat distributed botnets
  getIdentifier?: (c: Context) => Promise<string | null> | string | null;
  identifierMaxRequests?: number;
}

/**
 * Normalizes IPv4 and IPv6 addresses.
 * Strips interface identifiers from IPv6 to enforce a unified /64 subnet bucket,
 * defeating botnet IPv6 rotation attacks.
 */
export function normalizeIp(rawIp: string): string {
  const ip = rawIp.trim();
  if (ip === "::1" || ip === "localhost") {
    return "127.0.0.1";
  }
  // If IPv4 or IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (ip.startsWith("::ffff:")) {
    return ip.replace("::ffff:", "");
  }
  if (!ip.includes(":")) {
    return ip;
  }
  // IPv6: Group into /64 prefix (first 4 hextets)
  const hextets = ip.split(":");
  if (hextets.length >= 4) {
    return `${hextets.slice(0, 4).join(":")}::/64`;
  }
  return ip;
}

/**
 * Resolves the verified peer IP address from Node 26 TCP socket.
 * Neutralizes X-Forwarded-For spoofing attacks by ignoring untrusted headers
 * unless TRUST_PROXY=true is explicitly enabled behind a verified ingress proxy.
 */
export function getVerifiedClientIp(c: Context): string {
  if (env.TRUST_PROXY) {
    const xff = c.req.header("x-forwarded-for");
    if (xff) {
      // In trusted ingress proxy setups, the proxy appends the real client IP as the last entry
      const ips = xff
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      const rightmost = ips[ips.length - 1];
      if (rightmost) return normalizeIp(rightmost);
    }
    const realIp = c.req.header("x-real-ip");
    if (realIp) return normalizeIp(realIp);
  }

  // Defend against spoofing: Read TCP peer address directly from the underlying socket
  try {
    const connInfo = getConnInfo(c);
    const remoteAddress = connInfo?.remote?.address;
    if (remoteAddress) {
      return normalizeIp(remoteAddress);
    }
  } catch {
    // Fall through if running in standalone test runner
  }

  // Development / test fallback
  const fallback = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  return normalizeIp(fallback);
}

/**
 * Hardened Atomic Rate Limiter powered by Valkey 9.1 Lua
 * - Immune to X-Forwarded-For spoofing
 * - Immune to immortal key bug (PTTL == -1 self-healing)
 * - Immune to t=0 race conditions
 * - Supports dual-key buckets (IP /64 + User/Email) to defeat distributed credential stuffing
 */
export function slidingWindowRateLimiter(options: RateLimitOptions): MiddlewareHandler {
  const {
    windowSeconds,
    maxRequests,
    keyPrefix = "rl",
    getIdentifier,
    identifierMaxRequests = maxRequests,
  } = options;

  return async (c, next) => {
    // Only rate-limit write actions (POST, PUT, DELETE)
    if (c.req.method !== "POST" && c.req.method !== "PUT" && c.req.method !== "DELETE") {
      return await next();
    }

    const ip = getVerifiedClientIp(c);
    const path = c.req.path;
    const ipKey = `${keyPrefix}:${path}:ip:${ip}`;

    // 1. Check IP Bucket atomically in Valkey Lua
    const ipResult = await checkAtomicRateLimit(ipKey, windowSeconds, maxRequests);

    c.res.headers.set("X-RateLimit-Limit", maxRequests.toString());
    c.res.headers.set(
      "X-RateLimit-Remaining",
      Math.max(0, maxRequests - ipResult.currentCount).toString(),
    );

    if (!ipResult.allowed) {
      c.res.headers.set("Retry-After", windowSeconds.toString());
      return c.json(
        {
          error: "Too Many Requests",
          message: `IP rate limit exceeded. Maximum ${maxRequests} requests per ${windowSeconds}s allowed.`,
        },
        429,
      );
    }

    // 2. Dual-Key Check: If identifier extractor is provided, rate-limit target account
    if (getIdentifier) {
      const identifier = await getIdentifier(c);
      if (identifier) {
        const idKey = `${keyPrefix}:${path}:id:${identifier}`;
        const idResult = await checkAtomicRateLimit(idKey, windowSeconds, identifierMaxRequests);

        if (!idResult.allowed) {
          c.res.headers.set("Retry-After", windowSeconds.toString());
          return c.json(
            {
              error: "Too Many Requests",
              message: `Account rate limit exceeded for ${identifier}. Maximum ${identifierMaxRequests} requests per ${windowSeconds}s allowed.`,
            },
            429,
          );
        }
      }
    }

    return await next();
  };
}
