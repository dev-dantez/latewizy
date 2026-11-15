/**
 * POST /api/auth/switch-workspace
 *
 * Re-issues the session JWT with a new workspaceId.
 * The workspace must belong to the authenticated user.
 *
 * Body: { workspaceId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { workspaces } from "@/db/schema/workspaces";
import { requireSession, setSessionCookie } from "@/lib/auth/session";
import { z } from "zod";

const bodySchema = z.object({
  workspaceId: z.string().min(1),
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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Verify the workspace belongs to this user
  const [ws] = await db
    .select({ id: workspaces.id, zernioProfileId: workspaces.zernioProfileId, name: workspaces.name })
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, body.workspaceId),
        eq(workspaces.ownerId, session.userId)
      )
    )
    .limit(1);

  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Re-issue session with new workspaceId (same user and API key)
  await setSessionCookie({
    userId: session.userId,
    workspaceId: ws.id,
    zernioApiKey: session.zernioApiKey,
  });

  return NextResponse.json({
    workspaceId: ws.id,
    zernioProfileId: ws.zernioProfileId,
    name: ws.name,
  });
}
