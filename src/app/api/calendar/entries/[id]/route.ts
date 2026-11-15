/**
 * GET    /api/calendar/entries/[id]           — fetch single entry
 * PATCH  /api/calendar/entries/[id]           — update content / status
 * DELETE /api/calendar/entries/[id]           — delete entry
 * POST   /api/calendar/entries/[id]/approve   — approve → enqueue publish-entry
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarEntries } from "@/db/schema/calendar-entries";
import { enqueueJob } from "@/db/jobs";
import { requireSession } from "@/lib/auth/session";
import { z } from "zod";

type RouteParams = { params: Promise<{ id: string }> };

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }
  const { id } = await params;

  const [entry] = await db
    .select()
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.id, id),
        eq(calendarEntries.workspaceId, session.workspaceId)
      )
    )
    .limit(1);

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ entry });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  content: z.string().optional(),
  topic: z.string().optional(),
  scheduledFor: z.string().datetime().optional().nullable(),
  platforms: z
    .array(z.object({ platform: z.string(), accountId: z.string() }))
    .optional(),
  status: z
    .enum(["pending", "generating", "ready", "approved", "rejected"])
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }
  const { id } = await params;

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: calendarEntries.id })
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.id, id),
        eq(calendarEntries.workspaceId, session.workspaceId)
      )
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(calendarEntries)
    .set({
      ...(body.content !== undefined && { content: body.content }),
      ...(body.topic !== undefined && { topic: body.topic }),
      ...(body.scheduledFor !== undefined && {
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
      }),
      ...(body.platforms !== undefined && { platforms: body.platforms }),
      ...(body.status !== undefined && {
        status: body.status,
        ...(body.status === "rejected" && { rejectedAt: new Date() }),
        ...(body.status === "approved" && { approvedAt: new Date() }),
      }),
    })
    .where(eq(calendarEntries.id, id));

  const [updated] = await db
    .select()
    .from(calendarEntries)
    .where(eq(calendarEntries.id, id))
    .limit(1);

  return NextResponse.json({ entry: updated });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }
  const { id } = await params;

  const [existing] = await db
    .select({ status: calendarEntries.status })
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.id, id),
        eq(calendarEntries.workspaceId, session.workspaceId)
      )
    )
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (["publishing", "published"].includes(existing.status)) {
    return NextResponse.json(
      { error: "Cannot delete a published or in-flight entry" },
      { status: 409 }
    );
  }

  await db
    .delete(calendarEntries)
    .where(eq(calendarEntries.id, id));

  return NextResponse.json({ ok: true });
}

// ─── POST /approve ────────────────────────────────────────────────────────────
// This sub-action lives here rather than a separate route file for simplicity.
// Approve sets status=approved and enqueues the publish-entry job.

export async function POST(request: NextRequest, { params }: RouteParams) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }
  const { id } = await params;

  const url = new URL(request.url);
  if (!url.pathname.endsWith("/approve")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [entry] = await db
    .select()
    .from(calendarEntries)
    .where(
      and(
        eq(calendarEntries.id, id),
        eq(calendarEntries.workspaceId, session.workspaceId)
      )
    )
    .limit(1);

  if (!entry) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (entry.status !== "ready") {
    return NextResponse.json(
      { error: `Cannot approve entry with status "${entry.status}". Must be "ready".` },
      { status: 409 }
    );
  }

  // Update status and enqueue publish job atomically in sequence
  // (true outbox would wrap both in a DB transaction; sufficient for now)
  await db
    .update(calendarEntries)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(calendarEntries.id, id));

  await enqueueJob(
    session.workspaceId,
    "publish-entry",
    { calendarEntryId: id },
    {
      // singletonKey prevents duplicate publish jobs for the same entry
      idempotencyKey: `publish-entry:${id}`,
      priority: 10, // high priority
    }
  );

  return NextResponse.json({ ok: true });
}
