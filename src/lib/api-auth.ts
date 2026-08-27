import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getEnv } from "./env";
import { verifySessionToken, type SessionPayload } from "./jwt";
import { hasPermission, type PermissionModule, type PermissionAction } from "./permissions";

/**
 * Reads and verifies the session cookie for an API route handler.
 * Works both from a NextRequest (route handlers) and from the ambient
 * `cookies()` (server components) — API routes should prefer this over
 * middleware's own check, since middleware only guarantees a *page*
 * request was authenticated, not that every fetch to an API route was.
 */
export async function getSession(request?: NextRequest): Promise<SessionPayload | null> {
  const env = getEnv();
  const token = request ? request.cookies.get(env.COOKIE_NAME)?.value : cookies().get(env.COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/**
 * Ensures the request is authenticated AND the session's role grants
 * `action` on `module`. Throws ApiError (401/403) otherwise — call sites
 * should catch this via `withApiError` or a try/catch that maps it to a
 * NextResponse.
 */
export async function requirePermission(
  request: NextRequest,
  mod: PermissionModule,
  action: PermissionAction
): Promise<SessionPayload> {
  const session = await getSession(request);
  if (!session) {
    throw new ApiError(401, "Not authenticated.");
  }
  const isSuperAdmin = session.roleName === "Super Admin";
  if (!hasPermission(session.permissions, isSuperAdmin, mod, action)) {
    throw new ApiError(403, "You don't have permission to perform this action.");
  }
  return session;
}

/** Wraps a route handler body, converting thrown ApiError into a proper JSON response. */
export function withApiError(handler: () => Promise<NextResponse>): Promise<NextResponse> {
  return handler().catch((err) => {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  });
}
