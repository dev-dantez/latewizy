/**
 * collect-analytics job handler
 *
 * Payload shape:
 *   { calendarEntryId: string }
 *
 * Flow:
 *   1. Load CalendarEntry — verify workspace ownership
 *   2. Skip if not published yet (no zernioPostId)
 *   3. Resolve the Zernio API key from the workspace owner (multi-tenant)
 *   4. Pull per-post analytics from Zernio
 *   5. Store the snapshot on the entry's `analytics` column
 *
 * Best-effort: if Zernio returns an error, the job fails and retries later.
 * Requires the `analytics` column on calendar_entries — run `npm run db:push`
 * if it isn't applied yet, otherwise these jobs fail until the column exists.
 *
 * Enqueued by the publish-entry handler ~24h after a successful publish, so
 * metrics have time to accumulate.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarEntries } from "@/db/schema/calendar-entries";
import { workspaces } from "@/db/schema/workspaces";
import { users } from "@/db/schema/users";
import { createLateClient } from "@/lib/late-api/client";
import type { LockedJob } from "@/db/jobs";

export async function handleCollectAnalytics(job: LockedJob): Promise<void> {
  const { calendarEntryId } = job.payload as { calendarEntryId: string };

  if (!calendarEntryId) {
    throw new Error("Missing calendarEntryId in job payload");
  }

  // 1. Load and verify entry
  const [entry] = await db
    .select()
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.id, calendarEntryId),
        eq(calendarEntries.workspaceId, job.workspaceId)
      )
    )
    .limit(1);

  if (!entry) {
    throw new Error(`CalendarEntry ${calendarEntryId} not found in workspace ${job.workspaceId}`);
  }

  // 2. Nothing to collect until the post exists in Zernio
  if (!entry.zernioPostId) {
    console.log(`[collect-analytics] entry=${calendarEntryId} not published yet, skipping`);
    return;
  }

  // 3. Resolve the owner's API key (multi-tenant), fall back to env
  const apiKey = await resolveZernioApiKey(job.workspaceId);
  if (!apiKey) {
    throw new Error("No Zernio API key for workspace owner and LATE_API_KEY is not set");
  }

  // 4. Pull per-post analytics
  const late = createLateClient(apiKey);
  const { data, error } = await late.analytics.getAnalytics({
    query: { postId: entry.zernioPostId },
  });

  if (error) {
    throw new Error(`Zernio analytics error: ${String(error)}`);
  }

  // 5. Store the snapshot
  await db
    .update(calendarEntries)
    .set({
      analytics: {
        snapshot: data as unknown,
        collectedAt: new Date().toISOString(),
      },
    })
    .where(eq(calendarEntries.id, calendarEntryId));

  console.log(`[collect-analytics] stored analytics snapshot for entry=${calendarEntryId}`);
}

// ─── API key resolution (multi-tenant) ────────────────────────────────────────

async function resolveZernioApiKey(workspaceId: string): Promise<string | null> {
  const [ws] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (ws) {
    const [user] = await db
      .select({ zernioApiKey: users.zernioApiKey })
      .from(users)
      .where(eq(users.id, ws.ownerId))
      .limit(1);
    if (user?.zernioApiKey) return user.zernioApiKey;
  }

  return process.env.LATE_API_KEY ?? null;
}
