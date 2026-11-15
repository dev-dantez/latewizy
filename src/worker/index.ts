/**
 * LateWiz background worker
 *
 * Run with:  npm run worker
 *
 * Polls the jobs table every WORKER_POLL_INTERVAL_MS milliseconds and
 * dispatches each job to its handler. Handles graceful shutdown on
 * SIGTERM / SIGINT so in-flight jobs are not abandoned mid-execution.
 *
 * The autopilot scheduler runs on its own interval alongside the poll loop;
 * it enqueues an autopilot-cycle job for every enabled brand once per day.
 *
 * Each handler is responsible for:
 *  - Verifying workspace ownership before touching any data
 *  - Idempotency (check for existing results before calling Zernio)
 *  - Calling completeJob() or failJob() exactly once
 */

import { randomUUID } from "crypto";
import { pollNextJob, completeJob, failJob, backoffMs, type LockedJob } from "@/db/jobs";
import { handleGenerateContent } from "./handlers/generate-content";
import { handlePublishEntry } from "./handlers/publish-entry";
import { handleAutopilotCycle } from "./handlers/autopilot-cycle";
import { handleSendApprovalRequest } from "./handlers/send-approval-request";
import { handleCollectAnalytics } from "./handlers/collect-analytics";
import { startAutopilotScheduler, stopAutopilotScheduler } from "./scheduler";

// ─── Config ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5_000);
const WORKER_ID = `worker-${randomUUID().slice(0, 8)}`;

// ─── Handler registry ─────────────────────────────────────────────────────────

type JobHandler = (job: LockedJob) => Promise<void>;

const handlers: Partial<Record<string, JobHandler>> = {
  "generate-content": handleGenerateContent,
  "publish-entry": handlePublishEntry,
  "autopilot-cycle": handleAutopilotCycle,
  "send-approval-request": handleSendApprovalRequest,
  "collect-analytics": handleCollectAnalytics,
  // "generate-calendar", etc. registered here as built
};

// ─── Dispatch ─────────────────────────────────────────────────────────────────

async function processJob(job: LockedJob): Promise<void> {
  const startedAt = new Date();
  const handler = handlers[job.type];

  if (!handler) {
    // Unknown job type — fail permanently so it doesn't loop
    await failJob(job.id, `No handler registered for job type: ${job.type}`, startedAt, 0);
    console.error(`[worker] No handler for job type "${job.type}" (id=${job.id})`);
    return;
  }

  try {
    await handler(job);
    await completeJob(job.id, startedAt);
    console.log(`[worker] ✓ ${job.type} ${job.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const delay = backoffMs(job.attempts);
    await failJob(job.id, message, startedAt, delay);
    console.error(
      `[worker] ✗ ${job.type} ${job.id} attempt=${job.attempts}/${job.maxAttempts} retry_in=${delay}ms — ${message}`
    );
  }
}

// ─── Poll loop ────────────────────────────────────────────────────────────────

let running = true;

async function loop(): Promise<void> {
  console.log(`[worker] ${WORKER_ID} started, polling every ${POLL_INTERVAL_MS}ms`);

  while (running) {
    try {
      const job = await pollNextJob(WORKER_ID);
      if (job) {
        // Process synchronously — simple and safe. Add concurrency later if needed.
        await processJob(job);
        // Don't wait for the interval; check for more work immediately
        continue;
      }
    } catch (err) {
      console.error("[worker] Poll error:", err);
    }

    // No job found — wait before next poll
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  console.log(`[worker] ${WORKER_ID} shut down cleanly`);
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────

process.on("SIGTERM", () => {
  console.log("[worker] SIGTERM received — finishing current job then stopping");
  stopAutopilotScheduler();
  running = false;
});

process.on("SIGINT", () => {
  console.log("[worker] SIGINT received — finishing current job then stopping");
  stopAutopilotScheduler();
  running = false;
});

// ─── Start ────────────────────────────────────────────────────────────────────

// The autopilot scheduler runs on its own interval alongside the poll loop.
startAutopilotScheduler();

loop().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
