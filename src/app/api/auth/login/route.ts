/**
 * POST /api/auth/login
 *
 * Accepts a Zernio API key, validates it against the Zernio API,
 * upserts the user + default workspace in the DB, and issues a session cookie.
 *
 * Body: { apiKey: string, zernioProfileId?: string }
 * Response: { userId, workspaceId }
 */

import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema/users";
import { workspaces } from "@/db/schema/workspaces";
import { createLateClient } from "@/lib/late-api/client";
import { setSessionCookie } from "@/lib/auth/session";
import { z } from "zod";

const bodySchema = z.object({
  apiKey: z.string().min(1),
  zernioProfileId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { apiKey, zernioProfileId } = body;

  // 1. Validate API key against Zernio
  let zernioProfile: { _id: string; name?: string; timezone?: string } | null = null;
  try {
    const late = createLateClient(apiKey);
    const { data, error } = zernioProfileId
      ? await late.profiles.getProfile({ path: { profileId: zernioProfileId } })
      : await late.profiles.listProfiles();

    if (error) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    // Extract profile
    if (zernioProfileId) {
      zernioProfile = data as typeof zernioProfile;
    } else {
      const list = (data as { profiles?: typeof zernioProfile[] })?.profiles;
      zernioProfile = list?.[0] ?? null;
    }
  } catch {
    return NextResponse.json({ error: "Failed to validate API key" }, { status: 502 });
  }

  if (!zernioProfile) {
    return NextResponse.json(
      { error: "No Zernio profile found for this API key" },
      { status: 404 }
    );
  }

  // 2. Upsert user
  let userId: string;
  const [existingUser] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.zernioApiKey, apiKey))
    .limit(1);

  if (existingUser) {
    userId = existingUser.id;
  } else {
    userId = nanoid();
    await db.insert(users).values({
      id: userId,
      zernioApiKey: apiKey,
      displayName: zernioProfile.name ?? "LateWiz User",
    });
  }

  // 3. Upsert default workspace for this profile
  let workspaceId: string;
  const [existingWs] = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.zernioProfileId, zernioProfile._id))
    .limit(1);

  if (existingWs) {
    workspaceId = existingWs.id;
  } else {
    workspaceId = nanoid();
    await db.insert(workspaces).values({
      id: workspaceId,
      ownerId: userId,
      zernioProfileId: zernioProfile._id,
      name: zernioProfile.name ?? "My Workspace",
      timezone: zernioProfile.timezone ?? "UTC",
      isDefault: true,
    });
  }

  // 4. Issue session cookie
  await setSessionCookie({ userId, workspaceId, zernioApiKey: apiKey });

  return NextResponse.json({ userId, workspaceId });
}
