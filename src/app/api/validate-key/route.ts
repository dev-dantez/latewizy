import { NextRequest, NextResponse } from "next/server";
import { createLateClient } from "@/lib/late-api/client";
import { db } from "@/db/client";
import { users } from "@/db/schema/users";
import { workspaces } from "@/db/schema/workspaces";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    if (!apiKey.startsWith("sk_")) {
      return NextResponse.json(
        { error: "Invalid API key format" },
        { status: 400 }
      );
    }

    const late = createLateClient(apiKey);

    // Validate key + fetch usage + first profile in parallel
    const [usageResult, profilesResult] = await Promise.all([
      late.usage.getUsageStats(),
      late.profiles.listProfiles(),
    ]);

    if (usageResult.error || !usageResult.data) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401 }
      );
    }

    // ── Establish server-side session ─────────────────────────────────────
    // Upsert user
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
      });
    }

    // Upsert default workspace for the first Zernio profile
    const firstProfile = (profilesResult.data as { profiles?: Array<{ _id: string; name?: string; timezone?: string }> })
      ?.profiles?.[0];

    let workspaceId: string;
    if (firstProfile) {
      const [existingWs] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.zernioProfileId, firstProfile._id))
        .limit(1);

      if (existingWs) {
        workspaceId = existingWs.id;
      } else {
        workspaceId = nanoid();
        await db.insert(workspaces).values({
          id: workspaceId,
          ownerId: userId,
          zernioProfileId: firstProfile._id,
          name: firstProfile.name ?? "My Workspace",
          timezone: firstProfile.timezone ?? "UTC",
          isDefault: true,
        });
      }
    } else {
      // No Zernio profile yet — create a placeholder workspace
      const [existingWs] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.ownerId, userId))
        .limit(1);

      if (existingWs) {
        workspaceId = existingWs.id;
      } else {
        workspaceId = nanoid();
        await db.insert(workspaces).values({
          id: workspaceId,
          ownerId: userId,
          name: "My Workspace",
          timezone: "UTC",
          isDefault: true,
        });
      }
    }

    // Issue JWT session cookie (HttpOnly, secure in prod)
    await setSessionCookie({ userId, workspaceId, zernioApiKey: apiKey });

    return NextResponse.json({ data: usageResult.data });
  } catch (err) {
    console.error("API key validation error:", err);
    return NextResponse.json(
      { error: "Failed to validate API key" },
      { status: 500 }
    );
  }
}
