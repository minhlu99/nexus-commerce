import { db, orders, outboxEvents } from "@nexus/db";
import { env } from "@nexus/env";
import { commitInventoryPurchase } from "@nexus/kv";
import { injectTraceContext, withParentSpan, withSpan } from "@nexus/observability";
import { eq } from "drizzle-orm";

export async function processOutboxBatch(): Promise<number> {
  return await db.transaction(async (tx) => {
    // 1. Transactional Outbox: Lock unprocessed events with SKIP LOCKED
    // Multiple worker processes can run this concurrently without lock contention
    const pendingEvents = await tx
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.status, "pending"))
      .orderBy(outboxEvents.createdAt)
      .limit(20)
      .for("update", { skipLocked: true });

    if (pendingEvents.length === 0) {
      return 0;
    }

    for (const event of pendingEvents) {
      try {
        console.log(`[Worker] Processing Outbox Event: ${event.eventType} (${event.id})`);

        await withParentSpan(
          "outbox.process_event",
          event.payload as Record<string, unknown>,
          {
            "nexus.event_type": event.eventType,
            "nexus.aggregate_id": event.aggregateId,
            "nexus.outbox_id": event.id,
          },
          async () => {
            switch (event.eventType) {
              case "ORDER_CREATED": {
                const payload = event.payload as {
                  orderId: string;
                  customerId: string;
                  items: Array<{ sku: string; quantity: number }>;
                };

                // Deduct physical inventory & clean active hold in Valkey
                await withSpan(
                  "valkey.commit_purchase",
                  { "nexus.order_id": payload.orderId },
                  async () => {
                    for (const item of payload.items) {
                      await commitInventoryPurchase({
                        sku: item.sku,
                        holderId: payload.customerId,
                        quantity: item.quantity,
                      });
                    }
                  },
                );

                // Update order status in PostgreSQL from 'pending' to 'fulfilled'
                await withSpan(
                  "pg.fulfill_order",
                  { "nexus.order_id": payload.orderId },
                  async () => {
                    await tx
                      .update(orders)
                      .set({
                        status: "fulfilled",
                        updatedAt: new Date(),
                      })
                      .where(eq(orders.id, payload.orderId));
                  },
                );

                // Invalidate Next.js 16 catalog cache tag for impacted products (Polish Tweak A)
                await withSpan("nextjs.revalidate_webhook", async () => {
                  await triggerNextCacheInvalidation(["catalog", "orders"]);
                });
                break;
              }

              case "PRODUCT_UPDATED":
              case "INVENTORY_DEPLETED": {
                const payload = event.payload as { productId: string };
                await withSpan("nextjs.revalidate_webhook", async () => {
                  await triggerNextCacheInvalidation([`product-${payload.productId}`, "catalog"]);
                });
                break;
              }

              default:
                console.warn(`[Worker] Unknown outbox event type: ${event.eventType}`);
            }

            // Mark event completed
            await tx
              .update(outboxEvents)
              .set({
                status: "completed",
                processedAt: new Date(),
              })
              .where(eq(outboxEvents.id, event.id));
          },
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Worker] Failed processing event ${event.id}:`, err);

        await tx
          .update(outboxEvents)
          .set({
            status: event.attempts + 1 >= 5 ? "failed" : "pending",
            attempts: event.attempts + 1,
            error: message,
          })
          .where(eq(outboxEvents.id, event.id));
      }
    }

    return pendingEvents.length;
  });
}

/**
 * Polish Tweak A: Cross-Layer Cache Invalidation
 * Dispatches a secured webhook to Next.js 16 apps/web to trigger expireTag()
 */
async function triggerNextCacheInvalidation(tags: string[]): Promise<void> {
  try {
    const revalidateUrl = `${env.NEXT_PUBLIC_APP_URL}/api/revalidate`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "x-revalidate-secret": env.REVALIDATE_SECRET,
    };
    injectTraceContext(headers);

    const res = await fetch(revalidateUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ tags }),
    });

    if (!res.ok) {
      console.warn(`[Worker] Cache revalidation returned HTTP ${res.status}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Non-blocking: logs error if Next.js dev server is offline
    console.warn(`[Worker] Next.js cache revalidation skipped (App offline?): ${message}`);
  }
}
