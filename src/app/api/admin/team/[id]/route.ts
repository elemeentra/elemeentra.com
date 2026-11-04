import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { parseId } from "@/lib/api-utils";
import { textToParagraphs } from "@/lib/sanitize";
import { optionalText } from "@/lib/zod-helpers";
import { teamSchema, assertUserExists } from "@/lib/team";

interface FullTeamRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  name: string;
  role: string | null;
  photo_url: string | null;
  bio: string | null;
  linkedin_url: string | null;
  display_order: number;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "team", "view");
    const id = parseId(params.id, "team member");

    const rows = await query<FullTeamRow>("SELECT * FROM team_members WHERE id = ? LIMIT 1", [id]);
    const member = rows[0];
    if (!member) throw new ApiError(404, "Team member not found.");

    return NextResponse.json({ member });
  });
}

/** Full update from the edit form. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "team", "edit");
    const id = parseId(params.id, "team member");

    const parsed = teamSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    await assertUserExists(data.user_id);

    const setClauses = [
      "user_id = ?",
      "name = ?",
      "role = ?",
      "photo_url = ?",
      "bio = ?",
      "linkedin_url = ?",
    ];
    const values: unknown[] = [
      data.user_id,
      data.name,
      data.role,
      data.photo_url,
      data.bio ? textToParagraphs(data.bio) : null,
      data.linkedin_url,
    ];
    if (data.display_order !== undefined) {
      setClauses.push("display_order = ?");
      values.push(data.display_order);
    }

    const result = await execute(`UPDATE team_members SET ${setClauses.join(", ")} WHERE id = ?`, [
      ...values,
      id,
    ]);
    if (result.affectedRows === 0) {
      // affectedRows is also 0 when nothing changed on some drivers — confirm existence.
      const exists = await query<RowDataPacket>("SELECT id FROM team_members WHERE id = ? LIMIT 1", [id]);
      if (exists.length === 0) throw new ApiError(404, "Team member not found.");
    }

    return NextResponse.json({ id });
  });
}

const quickEditSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: optionalText(100),
  display_order: z.number().int().min(0).max(100000).optional(),
});

/** Partial update for the list page's Quick Edit — only touches the fields actually sent. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "team", "edit");
    const id = parseId(params.id, "team member");

    const body: unknown = await request.json().catch(() => null);
    const parsed = quickEditSchema.safeParse(body);
    if (!parsed.success || typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const data = parsed.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.name !== undefined) {
      setClauses.push("name = ?");
      values.push(data.name);
    }
    // `role` goes through a transform, so presence must be checked on the raw body.
    if ("role" in body) {
      setClauses.push("role = ?");
      values.push(data.role ?? null);
    }
    if (data.display_order !== undefined) {
      setClauses.push("display_order = ?");
      values.push(data.display_order);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const exists = await query<RowDataPacket>("SELECT id FROM team_members WHERE id = ? LIMIT 1", [id]);
    if (exists.length === 0) throw new ApiError(404, "Team member not found.");

    await execute(`UPDATE team_members SET ${setClauses.join(", ")} WHERE id = ?`, [...values, id]);
    return NextResponse.json({ success: true });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "team", "delete");
    const id = parseId(params.id, "team member");

    const result = await execute("DELETE FROM team_members WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Team member not found.");

    return NextResponse.json({ success: true });
  });
}
