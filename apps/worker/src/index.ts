import { processOutboxBatch } from "./outbox-poller.js";

async function startWorker() {
  console.log("⚡ Nexus Outbox & Queue Worker started");

  let isRunning = true;

  process.on("SIGINT", () => {
    console.log("Shutting down worker gracefully...");
    isRunning = false;
  });

  process.on("SIGTERM", () => {
    console.log("Shutting down worker gracefully...");
    isRunning = false;
  });

  while (isRunning) {
    try {
      const processedCount = await processOutboxBatch();

      // If work was found, poll immediately; otherwise wait 500ms
      if (processedCount === 0) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    } catch (err) {
      console.error("[Worker] Polling loop error:", err);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

startWorker();
