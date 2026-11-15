/**
 * autopilot-cycle job handler
 *
 * Payload shape:
 *   { brandId: string }
 *
 * Flow:
 *   1. Load AutopilotConfig — verify enabled + owned by job.workspaceId
 *   2. Determine how many entries still need to be generated for the
 *      lookahead window (postsPerCycle slots, deduped against existing entries)
 *   3. For each slot: pick a theme by weighted random, pick a schedule slot,
 *      insert a CalendarEntry (status=pending), then enqueue a generate-content
 *      job for it.
 *   4. If requireApproval=false the generate-content job will eventually flip
 *      status to ready; a separate publish-entry job fires from there.
 *
 * Idempotency: existing pending/ready entries within the lookahead window are
 * counted against postsPerCycle so we never double-generate.
 *
 * Safe to retry: DB inserts use a nanoid primary key; re-running the same
 * autopilot-cycle job would only add more entries — but the idempotency check
 * in enqueueJob (via idempotencyKey) prevents duplicate job dispatch.
 */

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { autopilotConfigs } from "@/db/schema/autopilot-configs";
import { brands } from "@/db/schema/brands";
import { calendarEntries } from "@/db/schema/calendar-entries";
import { enqueueJob } from "@/db/jobs";
import type { LockedJob } from "@/db/jobs";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScheduleSlot {
  dayOfWeek: number; // 0=Sunday … 6=Saturday
  time: string;      // "HH:mm"
}

interface Theme {
  id: string;
  name: string;
  description: string;
  weight: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Pick a theme by weighted random selection.
 * Weights do not need to sum to 1 — we normalise here.
 */
function pickTheme(themes: Theme[]): Theme {
  const totalWeight = themes.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight <= 0) return themes[Math.floor(Math.random() * themes.length)];

  let rand = Math.random() * totalWeight;
  for (const theme of themes) {
    rand -= theme.weight;
    if (rand <= 0) return theme;
  }
  return themes[themes.length - 1];
}

/**
 * Given a schedule slot (dayOfWeek + "HH:mm") and a base date, return the
 * next occurrence of that slot on or after `from`.
 */
function nextOccurrence(slot: ScheduleSlot, from: Date): Date {
  const [hours, minutes] = slot.time.split(":").map(Number);
  const result = new Date(from);
  result.setSeconds(0, 0);

  // Advance day until we hit the right weekday
  let iterations = 0;
  while (result.getDay() !== slot.dayOfWeek && iterations < 7) {
    result.setDate(result.getDate() + 1);
    iterations++;
  }
  result.setHours(hours, minutes, 0, 0);

  // If we landed in the past (same day, earlier time), push one week forward
  if (result <= from) {
    result.setDate(result.getDate() + 7);
  }
  return result;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function handleAutopilotCycle(job: LockedJob): Promise<void> {
  const { brandId } = job.payload as { brandId: string };

  if (!brandId) {
    throw new Error("Missing brandId in autopilot-cycle payload");
  }

  // 1. Load and verify autopilot config
  const [config] = await db
    .select()
    .from(autopilotConfigs)
    .where(
      and(
        eq(autopilotConfigs.brandId, brandId),
        eq(autopilotConfigs.workspaceId, job.workspaceId)
      )
    )
    .limit(1);

  if (!config) {
    throw new Error(
      `AutopilotConfig not found for brand=${brandId} workspace=${job.workspaceId}`
    );
  }

  if (!config.enabled) {
    console.log(`[autopilot-cycle] Skipping — autopilot disabled for brand=${brandId}`);
    return;
  }

  const themes = config.themes as Theme[];
  const schedule = config.schedule as ScheduleSlot[];
  const targetPlatforms = config.targetPlatforms as Array<{ platform: string; accountId: string }>;

  if (!themes.length) {
    throw new Error(`AutopilotConfig for brand=${brandId} has no themes configured`);
  }
  if (!schedule.length) {
    throw new Error(`AutopilotConfig for brand=${brandId} has no schedule slots configured`);
  }
  if (!targetPlatforms.length) {
    throw new Error(`AutopilotConfig for brand=${brandId} has no target platforms configured`);
  }

  // 2. Load brand (needed for the topic placeholder)
  const [brand] = await db
    .select({ brandName: brands.brandName })
    .from(brands)
    .where(
      and(
        eq(brands.id, brandId),
        eq(brands.workspaceId, job.workspaceId)
      )
    )
    .limit(1);

  if (!brand) {
    throw new Error(`Brand ${brandId} not found in workspace ${job.workspaceId}`);
  }

  // 3. Count active entries in the lookahead window to avoid over-generating
  const now = new Date();
  const windowEnd = new Date(now.getTime() + config.lookaheadDays * 24 * 60 * 60 * 1000);

  const activeStatuses = ["pending", "generating", "ready", "approved", "publishing", "published"] as const;

  const existingEntries = await db
    .select({ id: calendarEntries.id })
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.workspaceId, job.workspaceId),
        eq(calendarEntries.brandId, brandId),
        eq(calendarEntries.source, "autopilot"),
        inArray(calendarEntries.status, activeStatuses as unknown as [string, ...string[]]),
        gte(calendarEntries.scheduledFor, now),
        lte(calendarEntries.scheduledFor, windowEnd)
      )
    );

  const slotsNeeded = Math.max(0, config.postsPerCycle - existingEntries.length);

  if (slotsNeeded === 0) {
    console.log(
      `[autopilot-cycle] brand=${brandId} already has ${existingEntries.length}/${config.postsPerCycle} entries in window — nothing to do`
    );
    return;
  }

  console.log(
    `[autopilot-cycle] brand=${brandId} generating ${slotsNeeded} new entries (${existingEntries.length} existing)`
  );

  // 4. Generate entries for each needed slot
  //    Distribute across schedule slots in round-robin order, starting from now.
  let slotIndex = 0;
  let slotDate = new Date(now);

  for (let i = 0; i < slotsNeeded; i++) {
    const slot = schedule[slotIndex % schedule.length];
    const scheduledFor = nextOccurrence(slot, slotDate);

    // Guard: don't schedule beyond the lookahead window
    if (scheduledFor > windowEnd) {
      console.log(`[autopilot-cycle] Reached end of lookahead window after ${i} entries`);
      break;
    }

    // Advance slotDate past this slot so the next iteration finds the next occurrence
    slotDate = new Date(scheduledFor.getTime() + 60_000);
    slotIndex++;

    const theme = pickTheme(themes);
    const entryId = nanoid();

    // 5. Insert CalendarEntry
    await db.insert(calendarEntries).values({
      id: entryId,
      workspaceId: job.workspaceId,
      brandId,
      topic: `${theme.name}: ${theme.description}`,
      status: "pending",
      source: "autopilot",
      scheduledFor,
      platforms: targetPlatforms,
      hashtags: [],
      mediaUrls: [],
    });

    // 6. Enqueue generate-content job for this entry
    await enqueueJob(
      job.workspaceId,
      "generate-content",
      { calendarEntryId: entryId },
      {
        idempotencyKey: `generate-content:${entryId}`,
        priority: 50, // higher priority than default 100
      }
    );

    console.log(
      `[autopilot-cycle] Queued entry=${entryId} theme="${theme.name}" for ${scheduledFor.toISOString()}`
    );
  }
}
