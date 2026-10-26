import { zValidator } from "@hono/zod-validator";
import { db, eq, orderItems, orders, outboxEvents, productVariants } from "@nexus/db";
import { releaseInventoryHold, reserveInventory, valkey } from "@nexus/kv";
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

export const ordersRoutes = new Hono<{ Variables: AuthVariables }>().post(
  "/",
  zValidator("json", createOrderSchema),
  async (c) => {
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
    // Resolved customer: prefers verified session cookie, falls back to body for synthetic testing
    const currentUser = c.get("user");
    const customerId = currentUser?.id ?? body.customerId;

    if (!customerId) {
      await valkey.del(lockKey);
      return c.json({ error: "Unauthorized: Active session or customerId required" }, 401);
    }

    // Deterministic lexicographical sorting prevents multi-item deadlocks across Valkey & PostgreSQL
    const sortedItems = [...body.items].sort((a, b) => a.sku.localeCompare(b.sku));
    const acquiredHolds: Array<{ sku: string; quantity: number }> = [];

    try {
      // 2. Reserve Stock in Valkey (Option A: Dynamic HVALS with HEXPIRE)
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
          await valkey.del(lockKey);
          return c.json(
            {
              error: `Insufficient stock for SKU ${item.sku}. Only ${reservation.availableStock} available.`,
            },
            409,
          );
        }
        acquiredHolds.push(item);
      }

      // 3. PostgreSQL ACID Transaction (Order + Outbox)
      const order = await db.transaction(async (tx) => {
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

        // Transactional Outbox Event (guaranteed at-least-once delivery to BullMQ)
        await tx.insert(outboxEvents).values({
          eventType: "ORDER_CREATED",
          aggregateType: "order",
          aggregateId: newOrder!.id,
          payload: {
            orderId: newOrder!.id,
            customerId: customerId,
            items: body.items,
            totalAmountInCents,
          },
          status: "pending",
        });

        return newOrder;
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
  },
);
