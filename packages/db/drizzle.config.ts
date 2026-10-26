import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env.DATABASE_URL || "postgres://nexus:nexus_password@localhost:5432/nexus_commerce",
  },
  verbose: true,
  strict: true,
});
