import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { productVariants } from "./products";
import { stores } from "./stores";

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey().notNull(),
    storeId: uuid("store_id")
      .references(() => stores.id)
      .notNull(),
    customerId: text("customer_id").notNull(), // User identifier
    status: text("status", {
      enum: ["pending", "paid", "processing", "shipped", "fulfilled", "delivered", "cancelled"],
    })
      .default("pending")
      .notNull(),
    totalAmountInCents: integer("total_amount_in_cents").notNull(),
    currency: text("currency").default("USD").notNull(),
    idempotencyKey: text("idempotency_key").unique(),
    shippingAddress: jsonb("shipping_address")
      .$type<{
        fullName: string;
        street: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      }>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("order_store_idx").on(table.storeId),
    index("order_customer_idx").on(table.customerId),
    index("order_status_idx").on(table.status),
    index("order_idempotency_idx").on(table.idempotencyKey),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey().notNull(),
    orderId: uuid("order_id")
      .references(() => orders.id, { onDelete: "cascade" })
      .notNull(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id)
      .notNull(),
    // Snapshots: frozen pricing and title at moment of transaction
    frozenSku: text("frozen_sku").notNull(),
    frozenName: text("frozen_name").notNull(),
    unitPriceInCents: integer("unit_price_in_cents").notNull(),
    quantity: integer("quantity").notNull(),
    totalPriceInCents: integer("total_price_in_cents").notNull(),
  },
  (table) => [index("order_items_order_idx").on(table.orderId)],
);

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
