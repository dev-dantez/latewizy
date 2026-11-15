/**
 * send-approval-request job handler
 *
 * Payload shape:
 *   { calendarEntryId: string }
 *
 * Flow:
 *   1. Load CalendarEntry — verify workspace ownership
 *   2. Confirm the entry is "ready" (content generated, awaiting a human)
 *   3. Notify the workspace owner that content is ready for review
 *
 * Notification backend: this app has no email/webhook provider wired yet, so
 * the default notifier logs the pending-approval state (and resolves the
 * owner's email for routing). To send real notifications, plug a provider into
 * notifyOwner() below (email, push, Slack, etc.) — the handler and the
 * surrounding pipeline are already complete.
 *
 * Enqueued by the generate-content handler when an autopilot entry is ready
 * and the brand's autopilot config has requireApproval=true.
 */

import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarEntries } from "@/db/schema/calendar-entries";
import { workspaces } from "@/db/schema/workspaces";
import { users } from "@/db/schema/users";
import type { LockedJob } from "@/db/jobs";

/**
 * Notify the workspace owner that a calendar entry is ready for review.
 * Extension point: replace the log with a real provider (email, webhook, push).
 * Never throws — a notification failure must not block the approval flow.
 */
async function notifyOwner(
  workspaceId: string,
  entry: { id: string; topic: string }
): Promise<void> {
  // Resolve the owner + email for future per-user notification routing.
  let ownerEmail: string | null = null;
  const [ws] = await db
    .select({ ownerId: workspaces.ownerId })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (ws) {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, ws.ownerId))
      .limit(1);
    ownerEmail = user?.email ?? null;
  }

  // TODO(notification): wire a real provider here (email / webhook / push).
  // Until then, log so the approval flow is observable.
  console.log(
    `[send-approval-request] entry="${entry.topic}" (${entry.id}) ready for review` +
      (ownerEmail ? ` — owner: ${ownerEmail}` : "")
  );
}

export async function handleSendApprovalRequest(job: LockedJob): Promise<void> {
  const { calendarEntryId } = job.payload as { calendarEntryId: string };

  if (!calendarEntryId) {
    throw new Error("Missing calendarEntryId in job payload");
  }

  const [entry] = await db
    .select({
      id: calendarEntries.id,
      topic: calendarEntries.topic,
      status: calendarEntries.status,
    })
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

  if (entry.status !== "ready") {
    console.log(
      `[send-approval-request] entry=${calendarEntryId} status=${entry.status}, nothing to request`
    );
    return;
  }

  await notifyOwner(job.workspaceId, entry);
}
