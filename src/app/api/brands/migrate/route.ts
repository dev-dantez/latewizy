/**
 * POST /api/brands/migrate
 *
 * One-time migration: accepts an array of brands exported from localStorage
 * and writes them to the DB for the authenticated workspace.
 *
 * Safe to call multiple times — skips brands whose IDs already exist.
 *
 * Body: { brands: SavedBrand[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { brands } from "@/db/schema/brands";
import { requireSession } from "@/lib/auth/session";
import { z } from "zod";

const brandSchema = z.object({
  id: z.string(),
  brandName: z.string(),
  description: z.string(),
  tone: z.string(),
  voice: z.string(),
  targetAudience: z.string(),
  industry: z.string(),
  hashtags: z.array(z.string()).default([]),
  doList: z.array(z.string()).default([]),
  dontList: z.array(z.string()).default([]),
  defaultCTA: z.string(),
  isDefault: z.boolean().default(false),
  isArchived: z.boolean().default(false),
  // optional fields
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
});

const bodySchema = z.object({
  brands: z.array(brandSchema),
});

export async function POST(request: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (r) {
    return r as Response;
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid request body", details: err }, { status: 400 });
  }

  if (body.brands.length === 0) {
    return NextResponse.json({ migrated: 0, skipped: 0 });
  }

  let migrated = 0;
  let skipped = 0;

  for (const brand of body.brands) {
    // Check if ID already exists in this workspace
    const [existing] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(eq(brands.id, brand.id))
      .limit(1);

    if (existing) {
      skipped++;
      continue;
    }

    await db.insert(brands).values({
      ...brand,
      workspaceId: session.workspaceId,
      preferredColors: brand.preferredColors ?? [],
      colorsToAvoid: brand.colorsToAvoid ?? [],
    });

    migrated++;
  }

  return NextResponse.json({ migrated, skipped });
}
