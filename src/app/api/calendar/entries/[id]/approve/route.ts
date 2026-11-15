/**
 * POST /api/calendar/entries/[id]/approve
 * Approves a ready entry and enqueues the publish-entry job.
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { calendarEntries } from "@/db/schema/calendar-entries";
import { enqueueJob } from "@/db/jobs";
import { requireSession } from "@/lib/auth/session";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
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

  if (entry.status !== "ready") {
    return NextResponse.json(
      { error: `Cannot approve entry with status "${entry.status}". Must be "ready".` },
      { status: 409 }
    );
  }

  await db
    .update(calendarEntries)
    .set({ status: "approved", approvedAt: new Date() })
    .where(eq(calendarEntries.id, id));

  await enqueueJob(
    session.workspaceId,
    "publish-entry",
    { calendarEntryId: id },
    {
      idempotencyKey: `publish-entry:${id}`,
      priority: 10,
    }
  );

  return NextResponse.json({ ok: true });
}
