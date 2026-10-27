import { Queue } from "bullmq";
import { valkey } from "./connection.js";

export const QUEUE_NAMES = {
  ORDER_FULFILLMENT: "order-fulfillment",
  WEBHOOK_REVALIDATE: "webhook-revalidate",
} as const;

export interface OrderFulfillmentJobData {
  outboxId: string;
  orderId: string;
  customerId: string;
  items: Array<{ sku: string; quantity: number }>;
  totalAmountInCents?: number;
  [key: string]: unknown;
}

export interface WebhookRevalidateJobData {
  outboxId?: string;
  tags: string[];
  [key: string]: unknown;
}

// Queue instances share duplicate ioredis connections so BullMQ doesn't block global commands
export const fulfillmentQueue = new Queue<OrderFulfillmentJobData>(QUEUE_NAMES.ORDER_FULFILLMENT, {
  connection: valkey.duplicate(),
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 1000,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export const webhookQueue = new Queue<WebhookRevalidateJobData>(QUEUE_NAMES.WEBHOOK_REVALIDATE, {
  connection: valkey.duplicate(),
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: "exponential",
      delay: 500,
    },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export async function getQueueMetrics() {
  const [fulfillment, webhook] = await Promise.all([
    fulfillmentQueue.getJobCounts("active", "completed", "failed", "delayed", "waiting"),
    webhookQueue.getJobCounts("active", "completed", "failed", "delayed", "waiting"),
  ]);

  return {
    fulfillment,
    webhook,
  };
}
