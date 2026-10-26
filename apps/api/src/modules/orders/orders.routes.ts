import { zValidator } from "@hono/zod-validator";
import { db, eq, orderItems, orders, outboxEvents, productVariants } from "@nexus/db";
import { reserveInventory, valkey } from "@nexus/kv";
import { Hono } from "hono";
import { z } from "zod";

const createOrderSchema = z.object({
  storeId: z.string().uuid(),
  customerId: z.string().min(1),
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

export const ordersRoutes = new Hono().post(
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
      return c.json({ error: "Duplicate request or currently processing" }, 409);
    }

    const body = c.req.valid("json");

    try {
      // 2. Reserve Stock in Valkey (Option A: Dynamic HVALS with HEXPIRE)
      for (const item of body.items) {
        const reservation = await reserveInventory({
          sku: item.sku,
          holderId: body.customerId,
          quantity: item.quantity,
          ttlSeconds: 600, // 10 minute hold
        });

        if (!reservation.success) {
          await valkey.del(lockKey);
          return c.json(
            {
              error: `Insufficient stock for SKU ${item.sku}. Only ${reservation.availableStock} available.`,
            },
            409,
          );
        }
      }

      // 3. PostgreSQL ACID Transaction (Order + Outbox)
      const order = await db.transaction(async (tx) => {
        let totalAmountInCents = 0;
        const resolvedItems = [];

        for (const item of body.items) {
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
            customerId: body.customerId,
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
            customerId: body.customerId,
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
      await valkey.del(lockKey);
      const message = err instanceof Error ? err.message : "Failed to process order";
      return c.json({ error: message }, 500);
    }
  },
);
