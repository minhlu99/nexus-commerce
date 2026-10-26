import { serve } from "@hono/node-server";
import { env } from "@nexus/env";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { ordersRoutes } from "./modules/orders/orders.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";

const app = new Hono()
  .use("*", logger())
  .use(
    "*",
    cors({
      origin: [env.NEXT_PUBLIC_APP_URL, "http://localhost:3000"],
      credentials: true,
    }),
  )
  .get("/health", (c) => c.json({ status: "healthy", timestamp: new Date().toISOString() }))
  .route("/api/products", productsRoutes)
  .route("/api/orders", ordersRoutes);

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
