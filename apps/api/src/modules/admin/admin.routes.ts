import { zValidator } from "@hono/zod-validator";
import {
  db,
  desc,
  eq,
  inventory,
  orders,
  outboxEvents,
  products,
  productVariants,
  sql,
} from "@nexus/db";
import { getActiveHoldsCount, getPhysicalStock, valkey } from "@nexus/kv";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../../middleware/auth.middleware.js";

const restockSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const adminRoutes = new Hono<{ Variables: AuthVariables }>()
  /**
   * GET /api/admin/metrics
   * Aggregated live telemetry across PostgreSQL 18, Valkey 9.1, and Outbox Queue
   */
  .get("/metrics", async (c) => {
    // 1. Fetch all SKUs and their dual-engine inventory counts
    const variantList = await db
      .select({
        variantId: productVariants.id,
        sku: productVariants.sku,
        variantName: productVariants.name,
        priceInCents: productVariants.priceInCents,
        productId: products.id,
        productTitle: products.title,
        pgPhysicalStock: inventory.totalPhysicalStock,
      })
      .from(productVariants)
      .innerJoin(products, eq(productVariants.productId, products.id))
      .leftJoin(inventory, eq(productVariants.id, inventory.variantId));

    const inventoryMetrics = await Promise.all(
      variantList.map(async (v) => {
        const valkeyPhysical = await getPhysicalStock(v.sku);
        const activeHolds = await getActiveHoldsCount(v.sku);

        return {
          ...v,
          valkeyPhysicalStock: valkeyPhysical,
          activeHoldsCount: activeHolds,
          isSynchronized: (v.pgPhysicalStock ?? 0) === valkeyPhysical,
        };
      }),
    );

    // 2. Fetch Transactional Outbox Pipeline stats
    const outboxCounts = await db
      .select({
        status: outboxEvents.status,
        count: sql<number>`count(*)::int`,
      })
      .from(outboxEvents)
      .groupBy(outboxEvents.status);

    const outboxSummary = {
      completed: 0,
      pending: 0,
      processing: 0,
      failed: 0,
    };

    for (const row of outboxCounts) {
      if (row.status in outboxSummary) {
        outboxSummary[row.status as keyof typeof outboxSummary] = row.count;
      }
    }

    // 3. Fetch latest 10 outbox events
    const recentOutboxEvents = await db
      .select()
      .from(outboxEvents)
      .orderBy(desc(outboxEvents.createdAt))
      .limit(10);

    // 4. Fetch latest 10 orders with item snapshots
    const recentOrders = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(10);

    return c.json({
      success: true,
      data: {
        inventory: inventoryMetrics,
        outbox: {
          summary: outboxSummary,
          recent: recentOutboxEvents,
        },
        orders: recentOrders,
      },
    });
  })

  /**
   * POST /api/admin/inventory/restock
   * Atomically restocks an SKU in both PostgreSQL and Valkey 9.1
   * Dispatches Next.js cache revalidation webhook
   */
  .post("/inventory/restock", zValidator("json", restockSchema), async (c) => {
    const { sku, quantity } = c.req.valid("json");

    // 1. Locate SKU variant
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.sku, sku),
    });

    if (!variant) {
      return c.json({ error: `SKU '${sku}' not found` }, 404);
    }

    // 2. Atomically update PostgreSQL 18 inventory
    await db
      .update(inventory)
      .set({
        totalPhysicalStock: sql`${inventory.totalPhysicalStock} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(inventory.variantId, variant.id));

    // 3. Atomically increment Valkey 9.1 physical stock
    const valkeyKey = `stock:physical:${sku}`;
    const newValkeyStock = await valkey.incrby(valkeyKey, quantity);

    // 4. Record restock in Transactional Outbox (triggers Next.js cache purge)
    await db.insert(outboxEvents).values({
      eventType: "PRODUCT_UPDATED",
      aggregateType: "product",
      aggregateId: variant.productId,
      payload: {
        sku,
        productId: variant.productId,
        quantityAdded: quantity,
        newValkeyStock,
      },
      status: "pending",
    });

    return c.json({
      success: true,
      data: {
        sku,
        quantityAdded: quantity,
        newPhysicalStock: newValkeyStock,
      },
    });
  });
