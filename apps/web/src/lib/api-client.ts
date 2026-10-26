import type { AppType } from "@nexus/api/client";
import { env } from "@nexus/env";
import { hc } from "hono/client";

// Lightweight, 100% typed Hono RPC Client with cookie forwarding
export const api = hc<AppType>(env.NEXT_PUBLIC_API_URL, {
  init: {
    credentials: "include",
  },
});
