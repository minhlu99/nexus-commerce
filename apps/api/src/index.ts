// Ensure libuv thread pool size is expanded to 16 to prevent scrypt / DNS starvation
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";

import { serve } from "@hono/node-server";
import { auth } from "@nexus/auth";
import { env } from "@nexus/env";
import { initTelemetry, withSpan } from "@nexus/observability";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { type AuthVariables, sessionMiddleware } from "./middleware/auth.middleware.js";
import { slidingWindowRateLimiter } from "./middleware/rate-limit.middleware.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";

// Initialize OpenTelemetry distributed tracing
initTelemetry("nexus-api");

const app = new Hono<{ Variables: AuthVariables }>()
  // 1. Security Headers (Helmet equivalent): HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
  .use("*", secureHeaders())
  // 2. HTTP Payload Compression: Gzip / Deflate for fast JSON transfers
  .use("*", compress())
  // 3. Request Body Flood Protection: Reject JSON payloads > 100 KB before memory allocation
  .use(
    "*",
    bodyLimit({
      maxSize: 100 * 1024, // 100 KB max request body
      onError: (c) =>
        c.json(
          {
            error: "Payload Too Large",
            message: "Request body exceeds maximum allowable limit of 100 KB",
          },
          413,
        ),
    }),
  )
  .use("*", async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    return withSpan(
      `HTTP ${method} ${path}`,
      {
        "http.method": method,
        "http.url": c.req.url,
        "http.route": path,
      },
      async (span) => {
        await next();
        span.setAttribute("http.status_code", c.res.status);
      },
    );
  })
  .use("*", logger())
  .use(
    "*",
    cors({
      origin: [env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"],
      credentials: true,
    }),
  )
  .use("*", sessionMiddleware)
  .get("/health", (c) => c.json({ status: "healthy", timestamp: new Date().toISOString() }))
  // Dual-Key Rate Limiter on auth endpoints:
  // - IP Bucket (/64 IPv6 prefix): 10 req / 10s (Anti-Brute Force)
  // - Target Account Bucket (email): 5 req / 10s (Anti-Distributed Credential Stuffing)
  .use(
    "/api/auth/**",
    slidingWindowRateLimiter({
      windowSeconds: 10,
      maxRequests: 10,
      keyPrefix: "auth-limit",
      getIdentifier: async (c) => {
        try {
          const cloned = c.req.raw.clone();
          const json = await cloned.json();
          if (
            json &&
            typeof json === "object" &&
            "email" in json &&
            typeof json.email === "string"
          ) {
            return json.email.toLowerCase().trim();
          }
        } catch {
          // Non-JSON or empty body
        }
        return null;
      },
      identifierMaxRequests: 5,
    }),
  )
  // Dual-Key Rate Limiter on checkout submissions:
  // - IP Bucket: 150 req / 60s (Allows high-concurrency 100-buyer stress tests)
  // - Authenticated User Bucket: 30 req / 60s (Mitigates inventory hoarding & bot hold flooding)
  .use(
    "/api/orders",
    slidingWindowRateLimiter({
      windowSeconds: 60,
      maxRequests: 150,
      keyPrefix: "orders-limit",
      getIdentifier: (c) => c.get("user")?.id || null,
      identifierMaxRequests: 30,
    }),
  )
  // Mount Better Auth router: handles login, signup, session, oauth, signout
  .on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw))
  .route("/api/products", productsRoutes)
  .route("/api/orders", ordersRoutes)
  .route("/api/admin", adminRoutes);

// Export for Hono RPC type inference
export const apiRoutes = app;
export type AppType = typeof apiRoutes;

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
  },
  (info) => {
    console.log(`🚀 Nexus API Server listening on http://localhost:${info.port}`);
  },
);
