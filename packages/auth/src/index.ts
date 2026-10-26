import { accounts, db, sessions, users, verifications } from "@nexus/db";
import { env } from "@nexus/env";
import { valkey } from "@nexus/kv";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: false, // Prevent users from self-assigning elevated roles on signup
      },
    },
  },
  // Sub-millisecond session cache via Valkey 9.1
  secondaryStorage: {
    get: async (key: string) => {
      return await valkey.get(key);
    },
    set: async (key: string, value: string, ttl?: number) => {
      if (ttl) {
        await valkey.set(key, value, "EX", ttl);
      } else {
        await valkey.set(key, value);
      }
    },
    delete: async (key: string) => {
      await valkey.del(key);
    },
    getAndDelete: async (key: string) => {
      return await valkey.getdel(key);
    },
    increment: async (key: string, amount = 1) => {
      return await valkey.incrby(key, amount);
    },
  },
});

export type Auth = typeof auth;
export type UserRole = "customer" | "merchant" | "admin";
