import { initTelemetry } from "@nexus/observability";
import { startBullMQWorkers } from "./bullmq-workers.js";
import { processOutboxBatch } from "./outbox-poller.js";

// Initialize OpenTelemetry distributed tracing
initTelemetry("nexus-worker");

async function startWorker() {
  console.log("⚡ Nexus Outbox Relay & BullMQ Worker started");

  // Start Stage 2 BullMQ consumers
  const workers = startBullMQWorkers();

  let isRunning = true;

  process.on("SIGINT", async () => {
    console.log("Shutting down workers gracefully...");
    isRunning = false;
    await workers.shutdown();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("Shutting down workers gracefully...");
    isRunning = false;
    await workers.shutdown();
    process.exit(0);
  });

  while (isRunning) {
    try {
      const processedCount = await processOutboxBatch();

      // If work was found, poll immediately; otherwise wait 250ms
      if (processedCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } catch (err) {
      console.error("[Outbox Relay] Polling loop error:", err);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

startWorker();
