/**
 * Server-side session management
 *
 * Issues and verifies compact JWT sessions. The JWT subject is the user's
 * LateWiz user ID; the token also carries the active workspaceId so API
 * routes can scope queries without an extra DB lookup on every request.
 *
 * Tokens live in an HttpOnly cookie named "lw_session".
 * Lifetime: 30 days, auto-renewed on each authenticated request.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "lw_session";
const EXPIRY = "30d";
const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === "change-me-to-a-long-random-secret-before-deploying") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set to a secure random value in production");
    }
    // Allow dev to run without changing it, but warn loudly
    console.warn("[auth] WARNING: Using default JWT_SECRET. Set a real value in .env.local");
  }
  return new TextEncoder().encode(secret ?? "dev-secret-do-not-use-in-production");
}

export interface SessionPayload extends JWTPayload {
  userId: string;
  workspaceId: string;
  zernioApiKey: string; // needed by server-side Zernio calls
}

// ─── Sign ─────────────────────────────────────────────────────────────────────

export async function createSession(payload: Omit<SessionPayload, keyof JWTPayload>): Promise<string> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(getSecret());

  return token;
}

// ─── Verify ───────────────────────────────────────────────────────────────────

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

// ─── Cookie helpers (Server Components / Route Handlers) ──────────────────────

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(payload: Omit<SessionPayload, keyof JWTPayload>): Promise<void> {
  const token = await createSession(payload);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: EXPIRY_MS / 1000,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// ─── Middleware helper ────────────────────────────────────────────────────────

/**
 * Use in API route handlers to require an authenticated session.
 * Returns the session or throws a Response with 401.
 *
 * @example
 * export async function GET(req: NextRequest) {
 *   const session = await requireSession();
 *   // session.userId, session.workspaceId available
 * }
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return session;
}
