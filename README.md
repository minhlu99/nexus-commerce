# Nexus Commerce

Enterprise-grade, high-concurrency B2B/B2C E-Commerce & Inventory Management Platform.

## 🏗️ Architecture Stack

- **Runtime:** Node.js 26 Active LTS (`.nvmrc`) with Bun execution support
- **Monorepo:** Turborepo + pnpm workspaces
- **Frontend:** Next.js 16 (App Router, Turbopack, React 19)
- **API Server:** Hono HTTP Server + Hono RPC (Zero-codegen type-safety)
- **Worker Process:** Standalone Transactional Outbox consumer (`SELECT ... FOR UPDATE SKIP LOCKED`)
- **Database:** PostgreSQL 18 with Asynchronous I/O (`io_method=worker`) & native `uuidv7()`
- **Cache & Locks:** Valkey 9.1 (`valkey/valkey:9.1-alpine` with `HEXPIRE` dynamic inventory holds & AOF persistence)
- **ORM:** Drizzle ORM + Drizzle Kit
- **Code Quality:** Biome 2.4+ (Linter & Formatter)

---

## 📁 Monorepo Structure

```text
nexus-commerce/
├── apps/
│   ├── api/          # Hono RPC API server (routes, checkout transaction)
│   ├── worker/       # Standalone background outbox & BullMQ event processor
│   └── web/          # Next.js 16 frontend with Hono RPC client
│
├── packages/
│   ├── db/           # PostgreSQL schema (Drizzle ORM) + migrations + seed
│   ├── kv/           # Valkey 9.1 client + Lua dynamic inventory holds
│   ├── env/          # Type-safe environment validation (@t3-oss/env-core)
│   └── tsconfig/     # Strict TypeScript configurations
│
├── docker-compose.yml# Tuned PostgreSQL 18 & Valkey 9.1 services
├── turbo.json        # Pipeline caching & task orchestrator
└── biome.json        # Formatting and linting configuration
```

---

## 🚀 Quick Start

### 1. Start Infrastructure Services
```bash
# Starts PostgreSQL 18 (AIO) and Valkey 9.1 (AOF, noeviction)
pnpm services:up
```

### 2. Run Database Migrations & Seed
```bash
pnpm db:push
bun packages/db/src/seed.ts
```

### 3. Launch Development Environment
```bash
pnpm dev
```
- **Web Storefront:** `http://localhost:3000`
- **Hono API:** `http://localhost:4000`
- **Outbox Worker:** Polling PostgreSQL outbox events concurrently

---

## 🛡️ Concurrency & Flash-Sale Guardrails

1. **Option A Dynamic Stock Reservation (Valkey 9.1):**
   Uses `HVALS` dynamic summation of active holds alongside `HEXPIRE` time-to-live. When an abandoned cart expires after 10 minutes, Valkey silently purges the user field, and available inventory is **automatically and instantly restored** without counter drift.
2. **Transactional Outbox (`SKIP LOCKED`):**
   Eliminates the "dual-write" failure trap. Order creation, inventory snapshotting, and outbox event recording occur in the same ACID transaction before dispatching async fulfillment jobs.
3. **Idempotency Protection:**
   Checkout requests require an `Idempotency-Key` header locked in Valkey (`SET NX EX 86400`) to prevent duplicate transactions on network retries.
