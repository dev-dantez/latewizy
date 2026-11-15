/**
 * PATCH /api/brands/:id  — update a brand
 * DELETE /api/brands/:id — delete (hard) or archive (soft) a brand
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { brands } from "@/db/schema/brands";
import { requireSession } from "@/lib/auth/session";
import { z } from "zod";

// ─── shared ownership check ───────────────────────────────────────────────────

async function getOwnedBrand(id: string, workspaceId: string) {
  const [brand] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.id, id), eq(brands.workspaceId, workspaceId)))
    .limit(1);
  return brand ?? null;
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

const patchSchema = z.object({
  brandName: z.string().min(1).optional(),
  description: z.string().optional(),
  tone: z.string().optional(),
  voice: z.string().optional(),
  targetAudience: z.string().optional(),
  industry: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  doList: z.array(z.string()).optional(),
  dontList: z.array(z.string()).optional(),
  defaultCTA: z.string().optional(),
  website: z.string().optional(),
  niche: z.string().optional(),
  personality: z.string().optional(),
  language: z.string().optional(),
  writingStyle: z.string().optional(),
  contentRestrictions: z.string().optional(),
  additionalInstructions: z.string().optional(),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  headingFont: z.string().optional(),
  bodyFont: z.string().optional(),
  imageStyle: z.string().optional(),
  photographyStyle: z.string().optional(),
  illustrationStyle: z.string().optional(),
  preferredColors: z.array(z.string()).optional(),
  colorsToAvoid: z.array(z.string()).optional(),
  imageInstructions: z.string().optional(),
  isDefault: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }

  const { id } = await params;

  const existing = await getOwnedBrand(id, session.workspaceId);
  if (!existing) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  if (Object.keys(body).length === 0) {
    return NextResponse.json({ brand: existing });
  }

  // If making this brand default, unset default on siblings
  if (body.isDefault === true) {
    await db
      .update(brands)
      .set({ isDefault: false })
      .where(eq(brands.workspaceId, session.workspaceId));
  }

  await db
    .update(brands)
    .set({ ...body })
    .where(eq(brands.id, id));

  const [updated] = await db
    .select()
    .from(brands)
    .where(eq(brands.id, id))
    .limit(1);

  return NextResponse.json({ brand: updated });
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }

  const { id } = await params;

  const existing = await getOwnedBrand(id, session.workspaceId);
  if (!existing) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  await db
    .delete(brands)
    .where(and(eq(brands.id, id), eq(brands.workspaceId, session.workspaceId)));

  return NextResponse.json({ ok: true });
}
