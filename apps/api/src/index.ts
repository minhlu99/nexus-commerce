import { serve } from "@hono/node-server";
import { auth } from "@nexus/auth";
import { env } from "@nexus/env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { type AuthVariables, sessionMiddleware } from "./middleware/auth.middleware.js";
import { adminRoutes } from "./modules/admin/admin.routes.js";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";

const app = new Hono<{ Variables: AuthVariables }>()
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
