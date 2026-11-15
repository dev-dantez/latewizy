/**
 * Autopilot scheduler
 *
 * Runs on its own interval alongside the worker poll loop (same process).
 * On each tick it finds every fully-configured, enabled autopilot config and
 * enqueues an autopilot-cycle job for that brand.
 *
 * Cadence: one cycle per brand per day. The idempotency key is bucketed by
 * UTC date (YYYY-MM-DD), and enqueueJob skips a duplicate key while a
 * pending/running/completed job with that key exists — so a brand gets at
 * most one cycle per day even if the scheduler ticks many times.
 *
 * The cycle handler is itself idempotent: it counts existing entries in the
 * lookahead window against postsPerCycle, so it never over-generates.
 *
 * Interval: SCHEDULER_INTERVAL_MS (default 15 min). The daily bucket means
 * the first tick after midnight enqueues that day's cycle.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { autopilotConfigs } from "@/db/schema/autopilot-configs";
import { enqueueJob } from "@/db/jobs";

const TICK_MS = Number(process.env.SCHEDULER_INTERVAL_MS ?? 15 * 60 * 1000);

/** UTC date bucket: "YYYY-MM-DD" — one autopilot-cycle per brand per day. */
function todayBucket(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Enqueue an autopilot-cycle for every fully-configured, enabled brand.
 * A config is "fully configured" when it has at least one theme, one schedule
 * slot, and one target platform — otherwise the cycle handler would just fail.
 */
export async function runAutopilotTick(): Promise<void> {
  try {
    const configs = await db
      .select({
        workspaceId: autopilotConfigs.workspaceId,
        brandId: autopilotConfigs.brandId,
        themes: autopilotConfigs.themes,
        schedule: autopilotConfigs.schedule,
        targetPlatforms: autopilotConfigs.targetPlatforms,
      })
      .from(autopilotConfigs)
      .where(eq(autopilotConfigs.enabled, true));

    if (configs.length === 0) return;

    const bucket = todayBucket();
    let enqueued = 0;

    for (const config of configs) {
      const themes = (config.themes as unknown[]) ?? [];
      const schedule = (config.schedule as unknown[]) ?? [];
      const platforms = (config.targetPlatforms as unknown[]) ?? [];

      // Skip half-configured brands — the cycle handler would throw anyway
      if (themes.length === 0 || schedule.length === 0 || platforms.length === 0) {
        continue;
      }

      await enqueueJob(
        config.workspaceId,
        "autopilot-cycle",
        { brandId: config.brandId },
        {
          idempotencyKey: `autopilot-cycle:${config.brandId}:${bucket}`,
          priority: 200, // lower priority than user-initiated jobs
        }
      );
      enqueued++;
    }

    if (enqueued > 0) {
      console.log(
        `[scheduler] enqueued ${enqueued} autopilot-cycle job(s) [bucket=${bucket}]`
      );
    }
  } catch (err) {
    console.error("[scheduler] tick error:", err);
  }
}

let timer: NodeJS.Timeout | null = null;

/**
 * Start the scheduler. Fires one tick immediately, then on the interval.
 * Safe to call once; a second call is a no-op.
 */
export function startAutopilotScheduler(): void {
  if (timer) return;
  console.log(`[scheduler] autopilot scheduler started, tick every ${TICK_MS}ms`);

  timer = setInterval(() => {
    runAutopilotTick().catch(() => {
      // errors are logged inside runAutopilotTick
    });
  }, TICK_MS);

  // Kick off an immediate first tick (non-blocking)
  runAutopilotTick().catch(() => {});
}

/** Stop the scheduler. Called on graceful shutdown. */
export function stopAutopilotScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[scheduler] autopilot scheduler stopped");
  }
}
