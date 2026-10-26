import { env } from "@nexus/env";
import { Redis } from "ioredis";

// Valkey 9.1 client connection
export const valkey = new Redis(env.VALKEY_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});

export * from "./inventory.js";
