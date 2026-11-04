import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { parseId, placeholders } from "@/lib/api-utils";

const moveSchema = z.object({ direction: z.enum(["up", "down"]) });

/**
 * Moves one member a single position up/down the public ordering. Works on the
 * full ordered list (not just the visible page) and renumbers every row 1..n in
 * one statement — so duplicate or gappy display_order values heal themselves.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "team", "edit");
    const id = parseId(params.id, "team member");

    const parsed = moveSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const rows = await query<RowDataPacket>(
      "SELECT id FROM team_members ORDER BY display_order ASC, id ASC LIMIT 1000"
    );
    const ids = rows.map((r) => Number(r.id));
    const from = ids.indexOf(id);
    if (from === -1) throw new ApiError(404, "Team member not found.");

    const to = parsed.data.direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= ids.length) {
      return NextResponse.json({ success: true, moved: false });
    }

    [ids[from], ids[to]] = [ids[to], ids[from]];

    const cases = ids.map(() => "WHEN ? THEN ?").join(" ");
    const caseParams = ids.flatMap((memberId, index) => [memberId, index + 1]);
    await execute(
      `UPDATE team_members SET display_order = CASE id ${cases} END WHERE id IN (${placeholders(ids.length)})`,
      [...caseParams, ...ids]
    );

    return NextResponse.json({ success: true, moved: true });
  });
}
