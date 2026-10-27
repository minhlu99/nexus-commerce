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
import { getActiveHoldsCount, getPhysicalStock, getQueueMetrics, valkey } from "@nexus/kv";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../../middleware/auth.middleware.js";

const restockSchema = z.object({
  sku: z.string().min(1),
  quantity: z.number().int().positive(),
});

const simulateSchema = z.object({
  sku: z.string().default("NEX-PRO-BLK"),
  buyerCount: z.number().int().min(1).max(200).default(50),
  type: z.enum(["flash-sale", "idempotency-burst"]).default("flash-sale"),
});

export const adminRoutes = new Hono<{ Variables: AuthVariables }>()
  /**
   * GET /api/admin/metrics
   * Aggregated live telemetry across PostgreSQL 18, Valkey 9.1, Outbox Relay, and BullMQ Queues
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

    // 3. Fetch BullMQ Queue Metrics
    let queueMetrics: {
      fulfillment: Record<string, number>;
      webhook: Record<string, number>;
    } = {
      fulfillment: { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 },
      webhook: { active: 0, completed: 0, failed: 0, delayed: 0, waiting: 0 },
    };
    try {
      queueMetrics = await getQueueMetrics();
    } catch (err) {
      console.warn("[Admin API] Failed fetching BullMQ metrics:", err);
    }

    // 4. Executive KPI Stats: Total GMV, Total Orders, Order Status Breakdown
    const [gmvResult] = await db
      .select({
        totalGMV: sql<number>`COALESCE(SUM(${orders.totalAmountInCents}), 0)::int`,
        totalOrders: sql<number>`COUNT(*)::int`,
      })
      .from(orders);

    // 5. Fetch latest 10 outbox events
    const recentOutboxEvents = await db
      .select()
      .from(outboxEvents)
      .orderBy(desc(outboxEvents.createdAt))
      .limit(10);

    // 6. Fetch latest 10 orders with item snapshots
    const recentOrders = await db.select().from(orders).orderBy(desc(orders.id)).limit(10);

    return c.json({
      success: true,
      data: {
        kpis: {
          totalGMVInCents: gmvResult?.totalGMV ?? 0,
          totalOrdersCount: gmvResult?.totalOrders ?? 0,
        },
        inventory: inventoryMetrics,
        outbox: {
          summary: outboxSummary,
          recent: recentOutboxEvents,
        },
        queues: queueMetrics,
        orders: recentOrders,
      },
    });
  })

  /**
   * POST /api/admin/inventory/restock
   * Atomically restocks an SKU in both PostgreSQL and Valkey 9.1
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

    // 3. Atomically increment Valkey 9.1 physical stock (Commutative INCRBY)
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
  })

  /**
   * POST /api/admin/simulate-flash-sale
   * In-Browser Concurrency & Idempotency Traffic Simulator
   */
  .post("/simulate-flash-sale", zValidator("json", simulateSchema), async (c) => {
    const { sku, buyerCount, type } = c.req.valid("json");

    // 1. Fetch variant and store
    const variant = await db.query.productVariants.findFirst({
      where: eq(productVariants.sku, sku),
    });
    if (!variant) {
      return c.json({ error: `SKU '${sku}' not found` }, 404);
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, variant.productId),
    });
    if (!product) {
      return c.json({ error: "Product not found" }, 404);
    }

    const storeId = product.storeId;
    const variantId = variant.id;
    const port = process.env.PORT || 4000;

    // 2. Idempotency Burst Test: 5 simultaneous requests with identical Idempotency-Key
    if (type === "idempotency-burst") {
      const fixedKey = `sim-idempotency-${Date.now()}`;
      const startTime = performance.now();

      const promises = Array.from({ length: 5 }, (_, i) =>
        fetch(`http://localhost:${port}/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": fixedKey,
          },
          body: JSON.stringify({
            storeId,
            customerId: `sim_buyer_idem_${i}`,
            items: [{ variantId, sku, quantity: 1 }],
            shippingAddress: {
              fullName: `Sim Buyer ${i}`,
              street: "123 Market St",
              city: "San Francisco",
              state: "CA",
              postalCode: "94105",
              country: "US",
            },
          }),
        }).then(async (res) => ({
          status: res.status,
          data: await res.json(),
        })),
      );

      const results = await Promise.all(promises);
      const totalMs = Math.round(performance.now() - startTime);

      return c.json({
        success: true,
        type: "idempotency-burst",
        totalMs,
        results: results.map((r) => ({
          status: r.status,
          cached: (r.data as { cached?: boolean }).cached || false,
          orderId: (r.data as { data?: { orderId?: string } }).data?.orderId,
        })),
      });
    }

    // 3. Flash-Sale Concurrency Wave
    const startTime = performance.now();
    const batchId = Date.now();

    const promises = Array.from({ length: buyerCount }, async (_, i) => {
      const t0 = performance.now();
      try {
        const res = await fetch(`http://localhost:${port}/api/orders`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": `sim-flash-${batchId}-${i}`,
          },
          body: JSON.stringify({
            storeId,
            customerId: `sim_flash_buyer_${i}`,
            items: [{ variantId, sku, quantity: 1 }],
            shippingAddress: {
              fullName: `Sim Flash Buyer ${i}`,
              street: "456 Mission St",
              city: "San Francisco",
              state: "CA",
              postalCode: "94105",
              country: "US",
            },
          }),
        });

        const elapsed = Math.round(performance.now() - t0);
        return {
          buyerIndex: i + 1,
          status: res.status,
          durationMs: elapsed,
          ok: res.ok,
        };
      } catch (err) {
        return {
          buyerIndex: i + 1,
          status: 500,
          durationMs: Math.round(performance.now() - t0),
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    const results = await Promise.all(promises);
    const totalMs = Math.round(performance.now() - startTime);

    const latencies = results.map((r) => r.durationMs).sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] ?? 0;

    const successful201 = results.filter((r) => r.status === 201).length;
    const rejected409 = results.filter((r) => r.status === 409).length;
    const errors = results.filter((r) => r.status >= 500).length;

    const currentValkeyStock = await getPhysicalStock(sku);
    const activeHolds = await getActiveHoldsCount(sku);

    return c.json({
      success: true,
      type: "flash-sale",
      metrics: {
        totalRequests: buyerCount,
        totalDurationMs: totalMs,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99,
        successfulOrders: successful201,
        soldOutRejections: rejected409,
        errors,
        currentValkeyStock,
        activeHolds,
      },
      results: results.slice(0, 25), // Sample slice for UI waterfall
    });
  });
