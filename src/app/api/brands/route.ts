/**
 * GET  /api/brands         — list brands for the active workspace
 * POST /api/brands         — create a brand
 * POST /api/brands/migrate — bulk-import brands from localStorage (one-time migration)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { brands } from "@/db/schema/brands";
import { requireSession } from "@/lib/auth/session";
import { z } from "zod";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }

  const rows = await db
    .select()
    .from(brands)
    .where(
      and(
        eq(brands.workspaceId, session.workspaceId),
        eq(brands.isArchived, false)
      )
    );

  return NextResponse.json({ brands: rows });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

const createBrandSchema = z.object({
  brandName: z.string().min(1),
  description: z.string().min(1),
  tone: z.string().min(1),
  voice: z.string().min(1),
  targetAudience: z.string().min(1),
  industry: z.string().min(1),
  hashtags: z.array(z.string()).default([]),
  doList: z.array(z.string()).default([]),
  dontList: z.array(z.string()).default([]),
  defaultCTA: z.string().min(1),
  // Optional extended fields
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
  isDefault: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }

  let body: z.infer<typeof createBrandSchema>;
  try {
    body = createBrandSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  // If new brand is default, unset default on existing ones
  if (body.isDefault) {
    await db
      .update(brands)
      .set({ isDefault: false })
      .where(eq(brands.workspaceId, session.workspaceId));
  }

  const id = nanoid();
  await db.insert(brands).values({
    id,
    workspaceId: session.workspaceId,
    ...body,
  });

  const [created] = await db
    .select()
    .from(brands)
    .where(eq(brands.id, id))
    .limit(1);

  return NextResponse.json({ brand: created }, { status: 201 });
}
