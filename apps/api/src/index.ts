// Ensure libuv thread pool size is expanded to 16 to prevent scrypt / DNS starvation
process.env.UV_THREADPOOL_SIZE = process.env.UV_THREADPOOL_SIZE || "16";

import { serve } from "@hono/node-server";
import { auth } from "@nexus/auth";
import { env } from "@nexus/env";
import { initTelemetry, withSpan } from "@nexus/observability";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { type AuthVariables, sessionMiddleware } from "./middleware/auth.middleware.js";
import { slidingWindowRateLimiter } from "./middleware/rate-limit.middleware.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";

// Initialize OpenTelemetry distributed tracing
initTelemetry("nexus-api");

const app = new Hono<{ Variables: AuthVariables }>()
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
  // Rate-limit auth endpoints to prevent scrypt libuv saturation and login burst DoS
  .use(
    "/api/auth/**",
    slidingWindowRateLimiter({
      windowSeconds: 10,
      maxRequests: 10,
      keyPrefix: "auth-limit",
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
