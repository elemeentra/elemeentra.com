import { NextRequest, NextResponse } from "next/server";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError, invalidateSessionCache } from "@/lib/api-auth";
import { parseId } from "@/lib/api-utils";
import { SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { roleSchema, isReservedRoleName, parsePermissions } from "@/lib/roles";

interface RoleRow extends RowDataPacket {
  id: number;
  name: string;
  is_system_role: number;
  permissions: string | Record<string, string[]>;
}

async function loadRole(id: number): Promise<RoleRow> {
  const rows = await query<RoleRow>("SELECT * FROM roles WHERE id = ? LIMIT 1", [id]);
  if (!rows[0]) throw new ApiError(404, "Role not found.");
  return rows[0];
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "users", "view");
    const role = await loadRole(parseId(params.id, "role"));
    return NextResponse.json({
      role: {
        id: role.id,
        name: role.name,
        is_system_role: Boolean(role.is_system_role),
        permissions: parsePermissions(role.permissions),
      },
    });
  });
}

async function PUTImpl(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "users", "edit");
    const id = parseId(params.id, "role");
    const role = await loadRole(id);

    // Super Admin bypasses permission maps entirely; editing it would be meaningless at best.
    if (role.name === SUPER_ADMIN_ROLE) throw new ApiError(403, "The Super Admin role can't be edited.");

    const parsed = roleSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { name, permissions } = parsed.data;

    if (role.is_system_role) {
      if (name !== role.name) throw new ApiError(400, "System role names can't be changed.");
    } else {
      if (isReservedRoleName(name)) throw new ApiError(400, `"${name}" is a reserved role name.`);
      const dupe = await query<RowDataPacket>(
        "SELECT id FROM roles WHERE LOWER(name) = LOWER(?) AND id <> ? LIMIT 1",
        [name, id]
      );
      if (dupe.length > 0) throw new ApiError(409, "A role with this name already exists.");
    }

    await execute("UPDATE roles SET name = ?, permissions = ? WHERE id = ?", [
      role.is_system_role ? role.name : name,
      JSON.stringify(permissions),
      id,
    ]);
    return NextResponse.json({ id });
  });
}

async function DELETEImpl(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "users", "delete");
    const id = parseId(params.id, "role");
    const role = await loadRole(id);

    if (role.is_system_role) throw new ApiError(403, "System roles can't be deleted.");

    const inUse = await query<RowDataPacket>("SELECT COUNT(*) AS c FROM users WHERE role_id = ?", [id]);
    const count = Number(inUse[0]?.c ?? 0);
    if (count > 0) {
      throw new ApiError(
        409,
        `${count} user${count === 1 ? " is" : "s are"} still assigned to this role. Reassign them first.`
      );
    }

    await execute("DELETE FROM roles WHERE id = ?", [id]);
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

export async function DELETE(...args: Parameters<typeof DELETEImpl>) {
  try {
    return await DELETEImpl(...args);
  } finally {
    invalidateSessionCache(); // permissions/status may have changed
  }
}
