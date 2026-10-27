import { db, outboxEvents } from "@nexus/db";
import {
  fulfillmentQueue,
  type OrderFulfillmentJobData,
  type WebhookRevalidateJobData,
  webhookQueue,
} from "@nexus/kv";
import { withParentSpan, withSpan } from "@nexus/observability";
import { eq } from "drizzle-orm";

/**
 * Stage 1: Transactional Outbox Relay
 * Fast poller that locks pending events with SKIP LOCKED and dispatches into BullMQ queues
 */
export async function processOutboxBatch(): Promise<number> {
  return await db.transaction(async (tx) => {
    // Lock unprocessed events with SKIP LOCKED
    const pendingEvents = await tx
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.status, "pending"))
      .orderBy(outboxEvents.createdAt)
      .limit(50)
      .for("update", { skipLocked: true });

    if (pendingEvents.length === 0) {
      return 0;
    }

    for (const event of pendingEvents) {
      try {
        console.log(`[Outbox Relay] Enqueuing Event to BullMQ: ${event.eventType} (${event.id})`);

        await withParentSpan(
          "outbox.relay_to_bullmq",
          event.payload as Record<string, unknown>,
          {
            "nexus.event_type": event.eventType,
            "nexus.aggregate_id": event.aggregateId,
            "nexus.outbox_id": event.id,
          },
          async () => {
            switch (event.eventType) {
              case "ORDER_CREATED": {
                const payload = event.payload as OrderFulfillmentJobData;
                await withSpan("bullmq.enqueue_fulfillment", async () => {
                  await fulfillmentQueue.add(
                    "fulfill-order",
                    {
                      ...payload,
                      outboxId: event.id,
                    },
                    {
                      jobId: `outbox-${event.id}`, // Deduplication guarantee
                    },
                  );
                });
                break;
              }

              case "PRODUCT_UPDATED":
              case "INVENTORY_DEPLETED": {
                const payload = event.payload as { productId: string; [key: string]: unknown };
                await withSpan("bullmq.enqueue_webhook", async () => {
                  await webhookQueue.add(
                    "revalidate-product",
                    {
                      outboxId: event.id,
                      tags: [`product-${payload.productId}`, "catalog"],
                      ...payload,
                    } as WebhookRevalidateJobData,
                    {
                      jobId: `outbox-${event.id}`,
                    },
                  );
                });
                break;
              }

              default:
                console.warn(`[Outbox Relay] Unknown outbox event type: ${event.eventType}`);
            }

            // Mark outbox event relayed & completed in PG 18
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
        console.error(`[Outbox Relay] Failed relaying event ${event.id}:`, err);

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
