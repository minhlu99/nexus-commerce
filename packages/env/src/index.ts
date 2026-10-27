import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().default(4000),
    DATABASE_URL: z
      .string()
      .url()
      .default("postgres://nexus:nexus_password@localhost:5432/nexus_commerce"),
    VALKEY_URL: z.string().url().default("redis://localhost:6379"),
    REVALIDATE_SECRET: z.string().min(16).default("super-secret-revalidation-token-min-16-chars"),
    BETTER_AUTH_SECRET: z.string().min(16).default("better-auth-secret-string-at-least-16-chars"),
    BETTER_AUTH_URL: z.string().url().default("http://localhost:4000"),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default("http://localhost:4318/v1/traces"),
    TRUST_PROXY: z.coerce.boolean().default(false),
  },
  clientPrefix: "NEXT_PUBLIC_",
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:4000"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
