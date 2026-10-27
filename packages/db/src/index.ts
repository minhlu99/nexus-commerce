import { env } from "@nexus/env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

// PostgreSQL 18 client pool with native connection tuning
export const queryClient = postgres(env.DATABASE_URL, {
  max: 20, // Connection pool size
  idle_timeout: 30,
  connect_timeout: 10,
});

export const db = drizzle(queryClient, { schema });
export type Database = typeof db;
export { and, asc, desc, eq, inArray, not, or, sql } from "drizzle-orm";
export * from "./schema/index.js";
