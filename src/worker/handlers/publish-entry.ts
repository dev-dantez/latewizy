/**
 * publish-entry job handler
 *
 * Payload shape:
 *   { calendarEntryId: string }
 *
 * Flow:
 *   1. Load CalendarEntry — verify workspace ownership
 *   2. IDEMPOTENCY CHECK: if zernioPostId is already set, skip Zernio call
 *   3. Call Zernio createPost
 *   4. Write zernioPostId + status=published + PublishingResult row
 *
 * Safe to retry: Zernio is only called when zernioPostId IS NULL.
 *
 * Multi-tenant: the Zernio API key is resolved from the workspace owner's user
 * row (the key they logged in with). Falls back to LATE_API_KEY for
 * single-tenant / legacy setups that don't have a user record.
 */

import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { calendarEntries } from "@/db/schema/calendar-entries";
import { publishingResults } from "@/db/schema/publishing-results";
import { workspaces } from "@/db/schema/workspaces";
import { users } from "@/db/schema/users";
import { createLateClient } from "@/lib/late-api/client";
import { enqueueJob, type LockedJob } from "@/db/jobs";

export async function handlePublishEntry(job: LockedJob): Promise<void> {
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

  // 2. Idempotency: if already published, nothing to do
  if (entry.zernioPostId) {
    console.log(
      `[publish-entry] Entry ${calendarEntryId} already published (zernioPostId=${entry.zernioPostId}), skipping`
    );
    return;
  }

  if (!entry.content) {
    throw new Error(`CalendarEntry ${calendarEntryId} has no content — run generate-content first`);
  }

  if (!entry.platforms || (entry.platforms as unknown[]).length === 0) {
    throw new Error(`CalendarEntry ${calendarEntryId} has no target platforms`);
  }

  // 3. Mark as publishing
  await db
    .update(calendarEntries)
    .set({ status: "publishing" })
    .where(eq(calendarEntries.id, calendarEntryId));

  // 4. Resolve the Zernio API key for this workspace.
  //    Multi-tenant: the owner's stored key (the one they logged in with).
  //    Fallback: LATE_API_KEY env var for single-tenant / legacy setups.
  const apiKey = await resolveZernioApiKey(job.workspaceId);
  if (!apiKey) {
    throw new Error(
      "No Zernio API key for workspace owner and LATE_API_KEY is not set"
    );
  }

  const late = createLateClient(apiKey);

  const platforms = entry.platforms as Array<{
    platform: string;
    accountId: string;
    customContent?: string;
  }>;

  // 5. Create post in Zernio
  let zernioPostId: string;
  try {
    const { data, error } = await late.posts.createPost({
      body: {
        content: entry.content,
        mediaItems: (entry.mediaUrls as string[]).map((url) => ({
          type: "image" as const,
          url,
        })),
        platforms: platforms.map((p) => ({
          platform: p.platform as never,
          accountId: p.accountId,
          customContent: p.customContent,
        })),
        scheduledFor: entry.scheduledFor?.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    });

    if (error || !data) {
      throw new Error(String(error ?? "Empty response from Zernio"));
    }

    // The Zernio SDK returns the post object — extract its ID
    zernioPostId = (data as { _id?: string; id?: string })._id
      ?? (data as { _id?: string; id?: string }).id
      ?? "";

    if (!zernioPostId) {
      throw new Error("Zernio returned a post with no ID");
    }
  } catch (err) {
    // Write failure result before re-throwing so the history is complete
    await db.insert(publishingResults).values({
      id: nanoid(),
      workspaceId: job.workspaceId,
      calendarEntryId,
      platform: platforms.map((p) => p.platform).join(","),
      accountId: platforms.map((p) => p.accountId).join(","),
      outcome: "failure",
      error: err instanceof Error ? err.message : String(err),
    });

    await db
      .update(calendarEntries)
      .set({ status: "failed", failureReason: err instanceof Error ? err.message : String(err) })
      .where(eq(calendarEntries.id, calendarEntryId));

    throw err; // Re-throw so the worker records the failure and schedules retry
  }

  // 6. Mark published — write zernioPostId atomically with status update
  const now = new Date();
  await db
    .update(calendarEntries)
    .set({
      status: "published",
      zernioPostId,
      publishedAt: now,
    })
    .where(eq(calendarEntries.id, calendarEntryId));

  // 7. Write success publishing result
  await db.insert(publishingResults).values({
    id: nanoid(),
    workspaceId: job.workspaceId,
    calendarEntryId,
    zernioPostId,
    platform: platforms.map((p) => p.platform).join(","),
    accountId: platforms.map((p) => p.accountId).join(","),
    outcome: "success",
    publishedAt: now,
  });

  // 8. Schedule an analytics pull ~24h after publish so metrics have time to
  //    accumulate. Idempotent per entry; best-effort (never fails the publish).
  await enqueueJob(
    job.workspaceId,
    "collect-analytics",
    { calendarEntryId },
    {
      idempotencyKey: `collect-analytics:${calendarEntryId}`,
      priority: 200,
      runAfter: new Date(Date.now() + 24 * 60 * 60 * 1000),
    }
  ).catch(() => {
    // analytics collection is best-effort; never fail the publish on it
  });
}

// ─── API key resolution (multi-tenant) ────────────────────────────────────────

/**
 * Resolve the Zernio API key for a workspace. Prefers the owner's stored key
 * (multi-tenant); falls back to the LATE_API_KEY env var (single-tenant).
 */
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
