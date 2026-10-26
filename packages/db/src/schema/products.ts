import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { stores } from "./stores.js";

export const products = pgTable(
  "products",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    storeId: uuid("store_id")
      .references(() => stores.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    category: text("category").notNull(),
    isPublished: boolean("is_published").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("product_store_idx").on(table.storeId),
    index("product_category_idx").on(table.category),
    index("product_slug_idx").on(table.slug),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    productId: uuid("product_id")
      .references(() => products.id, { onDelete: "cascade" })
      .notNull(),
    sku: text("sku").notNull().unique(),
    name: text("name").notNull(), // e.g. "Space Black / 16GB"
    priceInCents: integer("price_in_cents").notNull(),
    attributes: jsonb("attributes").$type<Record<string, string>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("variant_sku_idx").on(table.sku),
    index("variant_product_idx").on(table.productId),
  ],
);

export const inventory = pgTable(
  "inventory",
  {
    id: uuid("id").default(sql`uuidv7()`).primaryKey(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    totalPhysicalStock: integer("total_physical_stock").default(0).notNull(),
    lowStockThreshold: integer("low_stock_threshold").default(5).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("inventory_variant_idx").on(table.variantId)],
);

export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Inventory = typeof inventory.$inferSelect;
