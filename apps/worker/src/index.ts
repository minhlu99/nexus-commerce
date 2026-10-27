import { queryClient } from "@nexus/db";
import { initTelemetry } from "@nexus/observability";
import { startBullMQWorkers } from "./bullmq-workers.js";
import { processOutboxBatch, pruneCompletedOutboxEvents } from "./outbox-poller.js";

// Initialize OpenTelemetry distributed tracing
initTelemetry("nexus-worker");

async function startWorker() {
  console.log("⚡ Nexus Outbox Relay & BullMQ Worker started");

  // Start Stage 2 BullMQ consumers
  const workers = startBullMQWorkers();

  let isRunning = true;
  let isDraining = false;

  const drainOutbox = async () => {
    if (isDraining || !isRunning) return;
    isDraining = true;
    try {
      let processed = 0;
      do {
        processed = await processOutboxBatch();
      } while (processed > 0 && isRunning);
    } catch (err) {
      console.error("[Outbox Relay] Batch drain error:", err);
    } finally {
      isDraining = false;
    }
  };

  // 1. Zero-Latency Event-Driven Relay via PostgreSQL 18 LISTEN/NOTIFY
  let listener: { unlisten: () => Promise<void> } | null = null;
  try {
    listener = await queryClient.listen("outbox_channel", () => {
      // Instant push notification: trigger immediate drain
      drainOutbox();
    });
    console.log("🔔 [Outbox Relay] Listening on PostgreSQL notification channel 'outbox_channel'");
  } catch (err) {
    console.warn("[Outbox Relay] Failed to initialize LISTEN, falling back to polling loop:", err);
  }

  // 2. Relaxed Fallback Polling Loop (every 5 seconds) for safety & connection drops
  const fallbackInterval = setInterval(() => {
    drainOutbox();
  }, 5000);

  // 3. Hourly Table Maintenance: Prune completed outbox rows older than 24h
  const maintenanceInterval = setInterval(async () => {
    try {
      const pruned = await pruneCompletedOutboxEvents();
      if (pruned > 0) {
        console.log(`🧹 [Outbox Maintenance] Pruned ${pruned} completed events older than 24h`);
      }
    } catch (err) {
      console.warn("[Outbox Maintenance] Pruning error:", err);
    }
  }, 3600000);

  // Initial startup drain
  drainOutbox();

  const shutdown = async () => {
    console.log("Shutting down workers gracefully...");
    isRunning = false;
    clearInterval(fallbackInterval);
    clearInterval(maintenanceInterval);
    if (listener) {
      try {
        await listener.unlisten();
      } catch {
        // ignore unlisten error during exit
      }
    }
    await workers.shutdown();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

startWorker();
