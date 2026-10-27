import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const stores = pgTable(
  "stores",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey().notNull(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description"),
    ownerId: text("owner_id").notNull(), // Links to Better-Auth user id
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("store_slug_idx").on(table.slug), index("store_owner_idx").on(table.ownerId)],
);

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
