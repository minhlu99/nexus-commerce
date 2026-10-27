import { db, orders } from "@nexus/db";
import { env } from "@nexus/env";
import {
  commitInventoryPurchase,
  type OrderFulfillmentJobData,
  QUEUE_NAMES,
  valkey,
  type WebhookRevalidateJobData,
  webhookQueue,
} from "@nexus/kv";
import { injectTraceContext, withParentSpan, withSpan } from "@nexus/observability";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";

/**
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
      console.warn(`[BullMQ Webhook] Cache revalidation returned HTTP ${res.status}`);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Non-blocking: logs error if Next.js dev server is offline
    console.warn(`[BullMQ Webhook] Next.js cache revalidation skipped: ${message}`);
  }
}

/**
 * Stage 2: Dedicated BullMQ Order Fulfillment Worker
 * Consumes jobs from Valkey with exponential backoff, concurrency limits, and distributed tracing
 */
export function startBullMQWorkers() {
  const fulfillmentWorker = new Worker<OrderFulfillmentJobData>(
    QUEUE_NAMES.ORDER_FULFILLMENT,
    async (job) => {
      console.log(`[BullMQ Fulfillment] Processing Job #${job.id} for Order: ${job.data.orderId}`);

      await withParentSpan(
        "bullmq.fulfill_order",
        job.data as Record<string, unknown>,
        {
          "nexus.job_id": String(job.id),
          "nexus.order_id": job.data.orderId,
          "nexus.customer_id": job.data.customerId,
        },
        async () => {
          // 1. Deduct physical stock in Valkey atomically via Lua commit
          await withSpan(
            "valkey.commit_purchase",
            { "nexus.order_id": job.data.orderId },
            async () => {
              for (const item of job.data.items) {
                await commitInventoryPurchase({
                  sku: item.sku,
                  holderId: job.data.customerId,
                  quantity: item.quantity,
                });
              }
            },
          );

          // 2. Transition Order Status in PostgreSQL to 'fulfilled'
          await withSpan("pg.fulfill_order", { "nexus.order_id": job.data.orderId }, async () => {
            await db
              .update(orders)
              .set({
                status: "fulfilled",
                updatedAt: new Date(),
              })
              .where(eq(orders.id, job.data.orderId));
          });

          // 3. Simulate Async Invoice Generation (Sub-millisecond mock email/PDF generation)
          await withSpan(
            "email.send_invoice",
            {
              "nexus.order_id": job.data.orderId,
              "nexus.customer_id": job.data.customerId,
            },
            async () => {
              // Simulated async invoice dispatch
              await new Promise((resolve) => setTimeout(resolve, 5));
            },
          );

          // 4. Enqueue Next.js Cache Invalidation to dedicated Webhook Queue
          const webhookPayload = injectTraceContext({
            tags: ["catalog", "orders"],
            orderId: job.data.orderId,
          });

          await webhookQueue.add("revalidate-catalog", webhookPayload as WebhookRevalidateJobData, {
            jobId: `revalidate-${job.data.orderId}`,
          });
        },
      );
    },
    {
      connection: valkey.duplicate(),
      concurrency: 10,
    },
  );

  const webhookWorker = new Worker<WebhookRevalidateJobData>(
    QUEUE_NAMES.WEBHOOK_REVALIDATE,
    async (job) => {
      console.log(
        `[BullMQ Webhook] Dispatching cache revalidation for tags: ${job.data.tags.join(", ")}`,
      );

      await withParentSpan(
        "bullmq.revalidate_webhook",
        job.data as Record<string, unknown>,
        { "nexus.tags": job.data.tags.join(",") },
        async () => {
          await triggerNextCacheInvalidation(job.data.tags);
        },
      );
    },
    {
      connection: valkey.duplicate(),
      concurrency: 5,
    },
  );

  fulfillmentWorker.on("completed", (job) => {
    console.log(`✅ [BullMQ Fulfillment] Job #${job.id} fulfilled successfully`);
  });

  fulfillmentWorker.on("failed", (job, err) => {
    console.error(`❌ [BullMQ Fulfillment] Job #${job?.id} failed:`, err.message);
  });

  webhookWorker.on("completed", (job) => {
    console.log(`✅ [BullMQ Webhook] Cache revalidation #${job.id} completed`);
  });

  return {
    fulfillmentWorker,
    webhookWorker,
    shutdown: async () => {
      await Promise.all([fulfillmentWorker.close(), webhookWorker.close()]);
    },
  };
}
