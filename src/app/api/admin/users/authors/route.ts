import { NextRequest, NextResponse } from "next/server";
import { query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";

interface UserRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  role_name: string;
}

/**
 * Lightweight user list — used by the blog editor's Author selector.
 * Gated on "blog" view permission (not "users", which is Super-Admin-only)
 * since any role that can write posts needs to see who they can assign as
 * author, not just Super Admins.
 */
export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "view");

    const users = await query<UserRow>(
      `SELECT u.id, u.name, u.email, r.name AS role_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.status = 'active'
       ORDER BY u.name ASC`
    );

    return NextResponse.json({ users });
  });
}
