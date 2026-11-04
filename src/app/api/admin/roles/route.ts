import { NextRequest, NextResponse } from "next/server";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError, invalidateSessionCache } from "@/lib/api-auth";
import { roleSchema, isReservedRoleName, parsePermissions } from "@/lib/roles";

interface RoleListRow extends RowDataPacket {
  id: number;
  name: string;
  is_system_role: number;
  permissions: string | Record<string, string[]>;
  user_count: number;
}

/** Not paginated: there are only a handful of roles. */
export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "users", "view");

    const rows = await query<RoleListRow>(
      `SELECT r.id, r.name, r.is_system_role, r.permissions,
              (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count
       FROM roles r
       ORDER BY r.is_system_role DESC, r.id ASC`
    );

    return NextResponse.json({
      items: rows.map((r) => ({
        id: r.id,
        name: r.name,
        is_system_role: Boolean(r.is_system_role),
        permissions: parsePermissions(r.permissions),
        user_count: Number(r.user_count),
      })),
    });
  });
}

async function POSTImpl(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "users", "create");

    const parsed = roleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { name, permissions } = parsed.data;

    // "Super Admin" is matched by NAME to bypass all permission checks, so a
    // look-alike role would be a privilege escalation — the name is reserved.
    if (isReservedRoleName(name)) throw new ApiError(400, `"${name}" is a reserved role name.`);

    const dupe = await query<RowDataPacket>("SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1", [name]);
    if (dupe.length > 0) throw new ApiError(409, "A role with this name already exists.");

    const result = await execute(
      "INSERT INTO roles (name, is_system_role, permissions) VALUES (?, 0, ?)",
      [name, JSON.stringify(permissions)]
    );
    return NextResponse.json({ id: result.insertId }, { status: 201 });
  });
}

export async function POST(...args: Parameters<typeof POSTImpl>) {
  try {
    return await POSTImpl(...args);
  } finally {
    invalidateSessionCache(); // permissions/status may have changed
  }
}
