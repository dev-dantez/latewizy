/**
 * POST /api/auth/switch-workspace-by-profile
 *
 * Finds (or creates) the workspace for a given Zernio profile ID,
 * then re-issues the session JWT with that workspaceId.
 *
 * Body: { zernioProfileId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema/workspaces";
import { requireSession, setSessionCookie } from "@/lib/auth/session";
import { createLateClient } from "@/lib/late-api/client";
import { z } from "zod";

const bodySchema = z.object({
  zernioProfileId: z.string().min(1),
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
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Verify the profile belongs to this API key via Zernio
  let profileName = "My Workspace";
  let profileTimezone = "UTC";
  try {
    const late = createLateClient(session.zernioApiKey);
    const { data, error } = await late.profiles.getProfile({
      path: { profileId: body.zernioProfileId },
    });
    if (error) {
      return NextResponse.json({ error: "Profile not found on Zernio" }, { status: 404 });
    }
    const p = data as { name?: string; timezone?: string } | null;
    profileName = p?.name ?? "My Workspace";
    profileTimezone = p?.timezone ?? "UTC";
  } catch {
    return NextResponse.json({ error: "Failed to verify Zernio profile" }, { status: 502 });
  }

  // Find or create workspace for this profile
  let workspaceId: string;

  const [existing] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.zernioProfileId, body.zernioProfileId),
        eq(workspaces.ownerId, session.userId)
      )
    )
    .limit(1);

  if (existing) {
    workspaceId = existing.id;
  } else {
    workspaceId = nanoid();
    await db.insert(workspaces).values({
      id: workspaceId,
      ownerId: session.userId,
      zernioProfileId: body.zernioProfileId,
      name: profileName,
      timezone: profileTimezone,
      isDefault: false,
    });
  }

  // Re-issue session
  await setSessionCookie({
    userId: session.userId,
    workspaceId,
    zernioApiKey: session.zernioApiKey,
  });

  return NextResponse.json({ workspaceId, name: profileName });
}
