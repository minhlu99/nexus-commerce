import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const outboxEvents = pgTable(
  "outbox_events",
  {
    // PostgreSQL 18 native uuidv7() for chronological B-Tree index ordering
    id: uuid("id").default(sql`uuidv7()`).primaryKey().notNull(),
    eventType: text("event_type").notNull(),
    aggregateType: text("aggregate_type").notNull(),
    aggregateId: text("aggregate_id").notNull(),
    payload: jsonb("payload").notNull(),
    status: text("status", { enum: ["pending", "processing", "completed", "failed"] })
      .default("pending")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    // High-performance partial index: keeps index size near 0 bytes regardless of historical volume
    index("idx_outbox_pending").on(table.createdAt).where(sql`status = 'pending'`),
    index("outbox_status_created_idx").on(table.status, table.createdAt),
    index("outbox_aggregate_idx").on(table.aggregateType, table.aggregateId),
  ],
);

export type OutboxEvent = typeof outboxEvents.$inferSelect;
export type NewOutboxEvent = typeof outboxEvents.$inferInsert;
