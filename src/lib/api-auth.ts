import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { cache } from "react";
import { getEnv } from "./env";
import { verifySessionToken, type SessionPayload } from "./jwt";
import { query, type RowDataPacket } from "./db";
import { hasPermission, SUPER_ADMIN_ROLE, type PermissionModule, type PermissionAction } from "./permissions";

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

interface FreshUserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  status: "active" | "inactive";
  role_id: number;
  role_name: string;
  profile_photo: string | null;
  permissions: string | Record<string, string[]>;
}

/**
 * Like getSession(), but re-reads the user + role from the database instead of
 * trusting the JWT snapshot. This is what makes Users & Roles changes take
 * effect immediately: a deactivated or deleted user is rejected on their very
 * next request, and role/permission edits apply without a re-login.
 */
// Short-lived in-process cache of the user+role lookup. Every admin click used
// to cost 2+ sequential DB round-trips just to re-validate the session (layout
// + API route), which is very noticeable against a remote database. Mutations
// in Users & Roles call invalidateSessionCache(), so changes still apply on the
// very next request in this process; across multiple instances the lag is
// bounded by the TTL.
const SESSION_TTL_MS = 60_000;
const freshCache = new Map<number, { at: number; value: FreshUser | null }>();

type FreshUser = Omit<SessionPayload, keyof SessionPayload> & {
  name: string; email: string; roleId: number; roleName: string; profilePhoto: string | null;
  permissions: Record<string, string[]>;
};

export function invalidateSessionCache(userId?: number): void {
  if (userId === undefined) freshCache.clear();
  else freshCache.delete(userId);
}

async function loadFreshUser(userId: number): Promise<FreshUser | null> {
  const hit = freshCache.get(userId);
  if (hit && Date.now() - hit.at < SESSION_TTL_MS) return hit.value;

  const rows = await query<FreshUserRow>(
    `SELECT u.id, u.name, u.email, u.status, r.id AS role_id, r.name AS role_name, u.profile_photo, r.permissions
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  const user = rows[0];
  let value: FreshUser | null = null;
  if (user && user.status === "active") {
    let permissions: Record<string, string[]> = {};
    try {
      permissions = typeof user.permissions === "string" ? JSON.parse(user.permissions) : user.permissions;
    } catch {
      permissions = {};
    }
    value = {
      name: user.name, email: user.email, roleId: user.role_id, roleName: user.role_name,
      profilePhoto: user.profile_photo ?? null, permissions,
    };
  }
  freshCache.set(userId, { at: Date.now(), value });
  return value;
}

export async function getFreshSession(request?: NextRequest): Promise<SessionPayload | null> {
  const token = await getSession(request);
  if (!token) return null;
  const fresh = await loadFreshUser(token.userId);
  if (!fresh) return null;
  return { ...token, ...fresh };
}

/** Per-request dedupe for server components (layout + page both asking). */
export const getFreshSessionCached = cache(() => getFreshSession());

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
  const session = await getFreshSession(request);
  if (!session) {
    throw new ApiError(401, "Not authenticated.");
  }
  const isSuperAdmin = session.roleName === SUPER_ADMIN_ROLE;
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
