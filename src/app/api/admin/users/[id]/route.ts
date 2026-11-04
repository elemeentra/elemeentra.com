import { NextRequest, NextResponse } from "next/server";
import { query, execute, withTransaction, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError, invalidateSessionCache } from "@/lib/api-auth";
import type { SessionPayload } from "@/lib/jwt";
import { parseId } from "@/lib/api-utils";
import { hashPassword } from "@/lib/password";
import { SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { textToParagraphs } from "@/lib/sanitize";
import { assertNotSelf, assertSuperAdminRemains } from "@/lib/user-guards";
import {
  assertEmailAvailable,
  assertRoleExists,
  quickEditUserSchema,
  rethrowDuplicateEmail,
  replaceSocialLinks,
  updateUserSchema,
} from "@/lib/users";

interface CurrentUserRow extends RowDataPacket {
  id: number;
  role_id: number;
  role_name: string;
  status: "active" | "inactive";
}

async function loadCurrent(id: number): Promise<CurrentUserRow> {
  const rows = await query<CurrentUserRow>(
    `SELECT u.id, u.role_id, r.name AS role_name, u.status
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [id]
  );
  if (!rows[0]) throw new ApiError(404, "User not found.");
  return rows[0];
}

/**
 * Shared guard for any change to role/status. You can't change your own role
 * or deactivate yourself, and the last active Super Admin can't be demoted or
 * deactivated (by anyone).
 */
async function assertRoleStatusChangeAllowed(
  session: SessionPayload,
  current: CurrentUserRow,
  next: { role_id: number; status: "active" | "inactive" }
): Promise<void> {
  const roleChanges = next.role_id !== current.role_id;
  const deactivates = current.status === "active" && next.status === "inactive";

  if (current.id === session.userId) {
    if (roleChanges) throw new ApiError(400, "You can't change your own role.");
    if (deactivates) throw new ApiError(400, "You can't deactivate your own account.");
  }

  if (current.role_name === SUPER_ADMIN_ROLE && (roleChanges || deactivates)) {
    await assertSuperAdminRemains([current.id]);
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "users", "view");
    const id = parseId(params.id, "user");

    // Password hash deliberately excluded.
    const rows = await query<RowDataPacket>(
      `SELECT id, name, email, role_id, custom_service, profile_photo, bio, status,
              last_login_at, created_at
       FROM users WHERE id = ? LIMIT 1`,
      [id]
    );
    if (!rows[0]) throw new ApiError(404, "User not found.");

    const links = await query<RowDataPacket>(
      `SELECT platform_name, platform_url, icon_type, custom_icon_url
       FROM user_social_links WHERE user_id = ? ORDER BY display_order ASC, id ASC`,
      [id]
    );
    return NextResponse.json({ user: { ...rows[0], social_links: links } });
  });
}

async function PUTImpl(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    const session = await requirePermission(request, "users", "edit");
    const id = parseId(params.id, "user");
    const current = await loadCurrent(id);

    const parsed = updateUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    await assertRoleExists(data.role_id);
    await assertEmailAvailable(data.email, id);
    await assertRoleStatusChangeAllowed(session, current, { role_id: data.role_id, status: data.status });

    const setClauses = [
      "name = ?",
      "email = ?",
      "role_id = ?",
      "status = ?",
      "custom_service = ?",
      "profile_photo = ?",
      "bio = ?",
    ];
    const values: unknown[] = [
      data.name,
      data.email,
      data.role_id,
      data.status,
      data.custom_service,
      data.profile_photo,
      data.bio ? textToParagraphs(data.bio) : null,
    ];
    if (data.password) {
      setClauses.push("password = ?", "failed_login_attempts = 0", "locked_until = NULL");
      values.push(await hashPassword(data.password));
    }

    try {
      await withTransaction(async (conn) => {
        await conn.execute(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`, [...values, id] as Array<string | number | null>);
        await replaceSocialLinks(conn, id, data.social_links);
      });
    } catch (err) {
      rethrowDuplicateEmail(err);
    }

    return NextResponse.json({ id });
  });
}

/** Quick Edit from the list page: name / role / status, or `{ unlock: true }`. */
async function PATCHImpl(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    const session = await requirePermission(request, "users", "edit");
    const id = parseId(params.id, "user");
    const current = await loadCurrent(id);

    const parsed = quickEditUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const data = parsed.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      setClauses.push("name = ?");
      values.push(data.name);
    }
    if (data.role_id !== undefined || data.status !== undefined) {
      const nextRole = data.role_id ?? current.role_id;
      const nextStatus = data.status ?? current.status;
      if (data.role_id !== undefined) await assertRoleExists(data.role_id);
      await assertRoleStatusChangeAllowed(session, current, { role_id: nextRole, status: nextStatus });
      if (data.role_id !== undefined) {
        setClauses.push("role_id = ?");
        values.push(data.role_id);
      }
      if (data.status !== undefined) {
        setClauses.push("status = ?");
        values.push(data.status);
      }
    }
    if (data.unlock) setClauses.push("failed_login_attempts = 0", "locked_until = NULL");

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    await execute(`UPDATE users SET ${setClauses.join(", ")} WHERE id = ?`, [...values, id]);
    return NextResponse.json({ success: true });
  });
}

async function DELETEImpl(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    const session = await requirePermission(request, "users", "delete");
    const id = parseId(params.id, "user");

    assertNotSelf(session.userId, [id], "delete");
    await loadCurrent(id);
    await assertSuperAdminRemains([id]);

    await execute("DELETE FROM users WHERE id = ?", [id]);
    return NextResponse.json({ success: true });
  });
}

export async function PUT(...args: Parameters<typeof PUTImpl>) {
  try {
    return await PUTImpl(...args);
  } finally {
    invalidateSessionCache(); // permissions/status may have changed
  }
}

export async function PATCH(...args: Parameters<typeof PATCHImpl>) {
  try {
    return await PATCHImpl(...args);
  } finally {
    invalidateSessionCache(); // permissions/status may have changed
  }
}

export async function DELETE(...args: Parameters<typeof DELETEImpl>) {
  try {
    return await DELETEImpl(...args);
  } finally {
    invalidateSessionCache(); // permissions/status may have changed
  }
}
