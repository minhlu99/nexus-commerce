import { env } from "@nexus/env";
import { Redis } from "ioredis";

// Dedicated Valkey 9.1 client connection configured for low-latency & BullMQ compatibility
export const valkey = new Redis(env.VALKEY_URL, {
  maxRetriesPerRequest: null, // Required by BullMQ for blocking workers
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
});
