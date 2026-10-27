import { zValidator } from "@hono/zod-validator";
import {
  db,
  desc,
  eq,
  inArray,
  orderItems,
  orders,
  outboxEvents,
  productVariants,
  sql,
} from "@nexus/db";
import { env } from "@nexus/env";
import { commitInventoryPurchase, releaseInventoryHold, reserveInventory, valkey } from "@nexus/kv";
import { injectTraceContext, withSpan } from "@nexus/observability";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthVariables } from "../../middleware/auth.middleware.js";

const createOrderSchema = z.object({
  storeId: z.string().uuid(),
  customerId: z.string().min(1).optional(), // Optional if user has active Better-Auth session cookie
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        sku: z.string().min(1),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1),
  shippingAddress: z.object({
    fullName: z.string().min(1),
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    postalCode: z.string().min(1),
    country: z.string().min(2),
  }),
});

export const ordersRoutes = new Hono<{ Variables: AuthVariables }>()
  /**
   * GET /api/orders
   * Fetches customer order history sorted by native uuidv7() DESC
   * (Guaranteed chronological B-Tree ordering without secondary sort index)
   */
  .get("/", async (c) => {
    const user = c.get("user");
    const queryCustomerId = c.req.query("customerId");
    const targetCustomerId = user?.id ?? queryCustomerId;

    const baseQuery = db.select().from(orders);

    const userOrders = targetCustomerId
      ? await baseQuery
          .where(eq(orders.customerId, targetCustomerId))
          .orderBy(desc(orders.id))
          .limit(50)
      : await baseQuery.orderBy(desc(orders.id)).limit(50);

    if (userOrders.length === 0) {
      return c.json({ data: [] });
    }

    // Fetch line item snapshots for these orders
    const orderIds = userOrders.map((o) => o.id);
    const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, orderIds));

    const ordersWithItems = userOrders.map((order) => ({
      ...order,
      items: items.filter((item) => item.orderId === order.id),
    }));

    return c.json({ data: ordersWithItems });
  })
  .post("/", zValidator("json", createOrderSchema), async (c) => {
    const idempotencyKey = c.req.header("Idempotency-Key");
    if (!idempotencyKey) {
      return c.json({ error: "Missing Idempotency-Key header" }, 400);
    }

    // 1. Valkey Idempotency Lock
    const lockKey = `idempotency:${idempotencyKey}`;
    const acquired = await valkey.set(lockKey, "PROCESSING", "EX", 86400, "NX");
    if (!acquired) {
      // In-flight simultaneous race handling: poll with backoff for fast-completing request
      for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await valkey.get(lockKey);
        if (existing && existing !== "PROCESSING") {
          try {
            const cached = JSON.parse(existing);
            return c.json({ success: true, cached: true, data: cached }, 200);
          } catch {
            // Fall through if not valid JSON
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return c.json({ error: "Duplicate request currently processing" }, 409);
    }

    const body = c.req.valid("json");
    // Production Security Guard: In production, strictly require verified session cookie
    // Allow synthetic body.customerId fallback only in development & test environments
    const currentUser = c.get("user");
    const customerId = currentUser?.id ?? (env.NODE_ENV !== "production" ? body.customerId : null);

    if (!customerId) {
      await valkey.del(lockKey);
      return c.json(
        { error: "Unauthorized: Valid authenticated session required for checkout" },
        401,
      );
    }

    // Deterministic lexicographical sorting prevents multi-item deadlocks across Valkey & PostgreSQL
    const sortedItems = [...body.items].sort((a, b) => a.sku.localeCompare(b.sku));
    const acquiredHolds: Array<{ sku: string; quantity: number }> = [];

    try {
      // 2. Reserve Stock in Valkey (Option A: Dynamic HVALS with HEXPIRE)
      const reservationResult = await withSpan(
        "valkey.reserve_stock",
        {
          "nexus.customer_id": customerId,
          "nexus.item_count": sortedItems.length,
        },
        async (span) => {
          for (const item of sortedItems) {
            const reservation = await reserveInventory({
              sku: item.sku,
              holderId: customerId,
              quantity: item.quantity,
              ttlSeconds: 600, // 10 minute hold
            });

            if (!reservation.success) {
              // Roll back previously acquired holds in this multi-item checkout
              for (const hold of acquiredHolds) {
                await releaseInventoryHold({ sku: hold.sku, holderId: customerId });
              }
              span.setAttribute("nexus.stock_error", true);
              span.setAttribute("nexus.failed_sku", item.sku);
              return {
                success: false as const,
                sku: item.sku,
                availableStock: reservation.availableStock,
              };
            }
            acquiredHolds.push(item);
          }
          return { success: true as const };
        },
      );

      if (!reservationResult.success) {
        await valkey.del(lockKey);
        return c.json(
          {
            error: `Insufficient stock for SKU ${reservationResult.sku}. Only ${reservationResult.availableStock} available.`,
          },
          409,
        );
      }

      // 3. PostgreSQL ACID Transaction (Order + Outbox)
      const order = await withSpan(
        "pg.checkout_transaction",
        {
          "nexus.store_id": body.storeId,
          "nexus.customer_id": customerId,
        },
        async (span) => {
          return await db.transaction(async (tx) => {
            let totalAmountInCents = 0;
            const resolvedItems = [];

            for (const item of sortedItems) {
              const variant = await tx.query.productVariants.findFirst({
                where: eq(productVariants.id, item.variantId),
              });

              if (!variant) {
                throw new Error(`Variant not found: ${item.variantId}`);
              }

              const lineTotal = variant.priceInCents * item.quantity;
              totalAmountInCents += lineTotal;

              resolvedItems.push({
                variantId: variant.id,
                frozenSku: variant.sku,
                frozenName: variant.name,
                unitPriceInCents: variant.priceInCents,
                quantity: item.quantity,
                totalPriceInCents: lineTotal,
              });
            }

            // Insert Order
            const [newOrder] = await tx
              .insert(orders)
              .values({
                storeId: body.storeId,
                customerId: customerId,
                status: "pending",
                totalAmountInCents,
                idempotencyKey,
                shippingAddress: body.shippingAddress,
              })
              .returning();

            // Insert Frozen Order Items
            await tx.insert(orderItems).values(
              resolvedItems.map((item) => ({
                ...item,
                orderId: newOrder!.id,
              })),
            );

            // Inject trace context so the worker can link its outbox execution as a child span!
            const outboxPayload = injectTraceContext({
              orderId: newOrder!.id,
              customerId: customerId,
              items: body.items,
              totalAmountInCents,
            });

            // Transactional Outbox Event (guaranteed at-least-once delivery to BullMQ)
            await tx.insert(outboxEvents).values({
              eventType: "ORDER_CREATED",
              aggregateType: "order",
              aggregateId: newOrder!.id,
              payload: outboxPayload,
              status: "pending",
            });

            // Zero-Latency Outbox Notification: triggers immediate worker pickup via LISTEN/NOTIFY
            await tx.execute(sql`NOTIFY outbox_channel`);

            span.setAttribute("nexus.order_id", newOrder!.id);
            span.setAttribute("nexus.total_amount_cents", totalAmountInCents);

            return newOrder;
          });
        },
      );

      // 4. Synchronous Valkey Commit (immediate sub-millisecond consistency)
      // Guarded by idempotent Lua script (HDEL == 1): outbox worker can safely re-run as crash recovery
      await withSpan("valkey.commit_purchase", { "nexus.order_id": order!.id }, async () => {
        for (const item of sortedItems) {
          await commitInventoryPurchase({
            sku: item.sku,
            holderId: customerId,
            quantity: item.quantity,
          });
        }
      });

      // Mark idempotency key as completed
      await valkey.set(
        lockKey,
        JSON.stringify({ orderId: order!.id, status: "SUCCESS" }),
        "EX",
        86400,
      );

      return c.json({ success: true, data: { orderId: order!.id, status: order!.status } }, 201);
    } catch (err: unknown) {
      // Roll back all acquired holds if transaction or server failed
      for (const hold of acquiredHolds) {
        await releaseInventoryHold({ sku: hold.sku, holderId: customerId });
      }
      await valkey.del(lockKey);
      const message = err instanceof Error ? err.message : "Failed to process order";
      return c.json({ error: message }, 500);
    }
  });
