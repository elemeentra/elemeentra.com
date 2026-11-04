import { NextRequest, NextResponse } from "next/server";
import { query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";

interface UserOption extends RowDataPacket {
  id: number;
  name: string;
}

/**
 * Minimal user list for the Team form's "Linked user" dropdown. Gated on
 * team:view (the Users module is Super-Admin-only) and exposes id + name only —
 * no emails or roles.
 */
export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "team", "view");
    const users = await query<UserOption>(
      "SELECT id, name FROM users WHERE status = 'active' ORDER BY name ASC"
    );
    return NextResponse.json({ users });
  });
}
