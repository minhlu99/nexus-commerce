// Lightweight type-only export for frontend Hono RPC client
// This prevents Next.js from importing heavy backend dependencies (postgres, ioredis, etc.)
export type { AppType } from "./index.js";
