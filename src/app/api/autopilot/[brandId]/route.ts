/**
 * GET  /api/autopilot/:brandId — fetch autopilot config for a brand
 * PUT  /api/autopilot/:brandId — upsert autopilot config for a brand
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { autopilotConfigs } from "@/db/schema/autopilot-configs";
import { brands } from "@/db/schema/brands";
import { requireSession } from "@/lib/auth/session";
import { z } from "zod";

const scheduleSlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  time: z.string().regex(/^\d{2}:\d{2}$/),
});

const themeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  weight: z.number().min(0).max(1),
});

const platformSchema = z.object({
  platform: z.string().min(1),
  accountId: z.string().min(1),
});

const upsertSchema = z.object({
  enabled: z.boolean().optional(),
  schedule: z.array(scheduleSlotSchema).optional(),
  themes: z.array(themeSchema).optional(),
  targetPlatforms: z.array(platformSchema).optional(),
  requireApproval: z.boolean().optional(),
  postsPerCycle: z.number().int().min(1).max(20).optional(),
  lookaheadDays: z.number().int().min(1).max(30).optional(),
});

async function getOwnedBrand(brandId: string, workspaceId: string) {
  const [row] = await db
    .select({ id: brands.id })
    .from(brands)
    .where(and(eq(brands.id, brandId), eq(brands.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const { brandId } = await params;

  if (!await getOwnedBrand(brandId, session.workspaceId)) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  const [config] = await db
    .select()
    .from(autopilotConfigs)
    .where(eq(autopilotConfigs.brandId, brandId))
    .limit(1);

  return NextResponse.json({ config: config ?? null });
}

// ─── PUT ──────────────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  let session;
  try { session = await requireSession(); } catch (r) { return r as Response; }

  const { brandId } = await params;

  if (!await getOwnedBrand(brandId, session.workspaceId)) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let body: z.infer<typeof upsertSchema>;
  try {
    body = upsertSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: autopilotConfigs.id })
    .from(autopilotConfigs)
    .where(eq(autopilotConfigs.brandId, brandId))
    .limit(1);

  if (existing) {
    await db
      .update(autopilotConfigs)
      .set({ ...body })
      .where(eq(autopilotConfigs.id, existing.id));
  } else {
    await db.insert(autopilotConfigs).values({
      id: nanoid(),
      workspaceId: session.workspaceId,
      brandId,
      enabled: body.enabled ?? false,
      schedule: body.schedule ?? [],
      themes: body.themes ?? [],
      targetPlatforms: body.targetPlatforms ?? [],
      requireApproval: body.requireApproval ?? true,
      postsPerCycle: body.postsPerCycle ?? 3,
      lookaheadDays: body.lookaheadDays ?? 7,
    });
  }

  const [updated] = await db
    .select()
    .from(autopilotConfigs)
    .where(eq(autopilotConfigs.brandId, brandId))
    .limit(1);

  return NextResponse.json({ config: updated });
}
