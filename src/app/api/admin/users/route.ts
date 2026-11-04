import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, withTransaction, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, invalidateSessionCache } from "@/lib/api-auth";
import {
  PAGE_SIZE,
  buildPagination,
  getPageParams,
  idsSchema,
  likeTerm,
  placeholders,
} from "@/lib/api-utils";
import { hashPassword } from "@/lib/password";
import { textToParagraphs } from "@/lib/sanitize";
import { assertNotSelf, assertSuperAdminRemains } from "@/lib/user-guards";
import {
  assertEmailAvailable,
  assertRoleExists,
  createUserSchema,
  rethrowDuplicateEmail,
  replaceSocialLinks,
} from "@/lib/users";

interface UserListRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  status: "active" | "inactive";
  profile_photo: string | null;
  last_login_at: string | null;
  created_at: string | null;
  locked: number;
}

interface StatsRow extends RowDataPacket {
  total: number;
  active: string | number | null;
  inactive: string | number | null;
  locked: string | number | null;
}

interface CountResult extends RowDataPacket {
  total: number;
}

const LOCKED_SQL = "(u.locked_until IS NOT NULL AND u.locked_until > NOW())";

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    const session = await requirePermission(request, "users", "view");

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const statusFilter = request.nextUrl.searchParams.get("status") ?? "";
    const { page, offset } = getPageParams(request);

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (search) {
      const like = likeTerm(search);
      whereParts.push("(u.name LIKE ? OR u.email LIKE ?)");
      params.push(like, like);
    }
    if (statusFilter === "active" || statusFilter === "inactive") {
      whereParts.push("u.status = ?");
      params.push(statusFilter);
    } else if (statusFilter === "locked") {
      whereParts.push(LOCKED_SQL);
    }

    const whereClause = whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    const [countRows, rows, statsRows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM users u ${whereClause}`, params),
      // The password hash is never selected.
      query<UserListRow>(
        `SELECT u.id, u.name, u.email, u.role_id, r.name AS role_name, u.status, u.profile_photo,
                u.last_login_at, u.created_at, ${LOCKED_SQL} AS locked
         FROM users u
         JOIN roles r ON r.id = u.role_id
         ${whereClause}
         ORDER BY u.created_at DESC, u.id DESC
         LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset]
      ),
      query<StatsRow>(
        `SELECT COUNT(*) AS total,
                SUM(u.status = 'active') AS active,
                SUM(u.status = 'inactive') AS inactive,
                SUM(${LOCKED_SQL}) AS locked
         FROM users u`
      ),
    ]);

    const total = countRows[0]?.total ?? 0;
    const s = statsRows[0];

    return NextResponse.json({
      items: rows.map((r) => ({ ...r, locked: Boolean(r.locked), is_self: r.id === session.userId })),
      pagination: buildPagination(page, total),
      stats: {
        total: Number(s?.total ?? 0),
        active: Number(s?.active ?? 0),
        inactive: Number(s?.inactive ?? 0),
        locked: Number(s?.locked ?? 0),
      },
    });
  });
}

async function POSTImpl(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "users", "create");

    const parsed = createUserSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;

    await assertEmailAvailable(data.email);
    await assertRoleExists(data.role_id);
    const passwordHash = await hashPassword(data.password);

    try {
      const id = await withTransaction(async (conn) => {
        const [result] = await conn.execute(
          `INSERT INTO users (name, email, password, role_id, custom_service, profile_photo, bio, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.name,
            data.email,
            passwordHash,
            data.role_id,
            data.custom_service,
            data.profile_photo,
            data.bio ? textToParagraphs(data.bio) : null,
            data.status,
          ]
        );
        const userId = (result as { insertId: number }).insertId;
        await replaceSocialLinks(conn, userId, data.social_links);
        return userId;
      });
      return NextResponse.json({ id }, { status: 201 });
    } catch (err) {
      rethrowDuplicateEmail(err);
    }
  });
}

const bulkUpdateSchema = z.object({
  ids: idsSchema,
  action: z.enum(["activate", "deactivate", "unlock"]),
});

/** Bulk activate / deactivate / unlock. */
async function PATCHImpl(request: NextRequest) {
  return withApiError(async () => {
    const session = await requirePermission(request, "users", "edit");

    const parsed = bulkUpdateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const { ids, action } = parsed.data;
    const ph = placeholders(ids.length);

    let result;
    if (action === "unlock") {
      result = await execute(
        `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id IN (${ph})`,
        ids
      );
    } else if (action === "activate") {
      result = await execute(`UPDATE users SET status = 'active' WHERE id IN (${ph})`, ids);
    } else {
      assertNotSelf(session.userId, ids, "deactivate");
      await assertSuperAdminRemains(ids);
      result = await execute(`UPDATE users SET status = 'inactive' WHERE id IN (${ph})`, ids);
    }

    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}

const bulkDeleteSchema = z.object({ ids: idsSchema });

async function DELETEImpl(request: NextRequest) {
  return withApiError(async () => {
    const session = await requirePermission(request, "users", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const { ids } = parsed.data;

    assertNotSelf(session.userId, ids, "delete");
    await assertSuperAdminRemains(ids);

    const result = await execute(`DELETE FROM users WHERE id IN (${placeholders(ids.length)})`, ids);
    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

export async function POST(...args: Parameters<typeof POSTImpl>) {
  try {
    return await POSTImpl(...args);
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
