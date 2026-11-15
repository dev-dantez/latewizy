/**
 * GET  /api/calendar/entries   — list entries for the workspace
 * POST /api/calendar/entries   — create an entry + enqueue generate-content job
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { calendarEntries } from "@/db/schema/calendar-entries";
import { enqueueJob } from "@/db/jobs";
import { requireSession } from "@/lib/auth/session";
import { z } from "zod";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }

  const { searchParams } = request.nextUrl;
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const status = searchParams.get("status");

  const conditions = [eq(calendarEntries.workspaceId, session.workspaceId)];

  if (dateFrom) {
    conditions.push(gte(calendarEntries.scheduledFor, new Date(dateFrom)));
  }
  if (dateTo) {
    conditions.push(lte(calendarEntries.scheduledFor, new Date(dateTo)));
  }
  if (status) {
    conditions.push(
      eq(calendarEntries.status, status as Parameters<typeof eq>[1])
    );
  }

  const rows = await db
    .select()
    .from(calendarEntries)
    .where(and(...conditions));

  return NextResponse.json({ entries: rows });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

const createEntrySchema = z.object({
  brandId: z.string().min(1),
  topic: z.string().min(1),
  scheduledFor: z.string().datetime().optional(),
  platforms: z
    .array(
      z.object({
        platform: z.string(),
        accountId: z.string(),
        customContent: z.string().optional(),
      })
    )
    .default([]),
  source: z.enum(["manual", "autopilot"]).default("manual"),
  /** If true, skip AI generation (content is provided directly). */
  content: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }

  let body: z.infer<typeof createEntrySchema>;
  try {
    body = createEntrySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  const id = nanoid();

  // If content is provided directly, skip generation and go straight to ready
  const hasContent = !!body.content;

  await db.insert(calendarEntries).values({
    id,
    workspaceId: session.workspaceId,
    brandId: body.brandId,
    topic: body.topic,
    content: body.content ?? null,
    platforms: body.platforms,
    scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
    status: hasContent ? "ready" : "pending",
    source: body.source,
    generatedAt: hasContent ? new Date() : null,
  });

  // Enqueue AI generation unless content was provided
  if (!hasContent) {
    await enqueueJob(
      session.workspaceId,
      "generate-content",
      { calendarEntryId: id },
      {
        idempotencyKey: `generate-content:${id}`,
        priority: 50,
      }
    );
  }

  const [created] = await db
    .select()
    .from(calendarEntries)
    .where(eq(calendarEntries.id, id))
    .limit(1);

  return NextResponse.json({ entry: created }, { status: 201 });
}
