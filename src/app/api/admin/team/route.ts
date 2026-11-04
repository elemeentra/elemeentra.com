import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import {
  PAGE_SIZE,
  buildPagination,
  getPageParams,
  idsSchema,
  likeTerm,
  placeholders,
} from "@/lib/api-utils";
import { textToParagraphs } from "@/lib/sanitize";
import { teamSchema, assertUserExists } from "@/lib/team";

export interface TeamRow extends RowDataPacket {
  id: number;
  user_id: number | null;
  name: string;
  role: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  display_order: number;
  user_name: string | null;
}

interface StatsRow extends RowDataPacket {
  total: number;
  linked: string | number | null;
}

interface CountResult extends RowDataPacket {
  total: number;
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "team", "view");

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const statusFilter = request.nextUrl.searchParams.get("status") ?? "";
    const { page, offset } = getPageParams(request);

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (search) {
      const like = likeTerm(search);
      whereParts.push("(t.name LIKE ? OR t.role LIKE ?)");
      params.push(like, like);
    }
    if (statusFilter === "linked") whereParts.push("t.user_id IS NOT NULL");
    if (statusFilter === "unlinked") whereParts.push("t.user_id IS NULL");

    const whereClause = whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    const [countRows, rows, statsRows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM team_members t ${whereClause}`, params),
      query<TeamRow>(
        `SELECT t.id, t.user_id, t.name, t.role, t.photo_url, t.linkedin_url, t.display_order,
                u.name AS user_name
         FROM team_members t
         LEFT JOIN users u ON u.id = t.user_id
         ${whereClause}
         ORDER BY t.display_order ASC, t.id ASC
         LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset]
      ),
      query<StatsRow>(
        `SELECT COUNT(*) AS total, SUM(user_id IS NOT NULL) AS linked FROM team_members`
      ),
    ]);

    const total = countRows[0]?.total ?? 0;
    const s = statsRows[0];

    return NextResponse.json({
      items: rows,
      pagination: buildPagination(page, total),
      stats: { total: Number(s?.total ?? 0), linked: Number(s?.linked ?? 0) },
    });
  });
}

export async function POST(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "team", "create");

    const parsed = teamSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    await assertUserExists(data.user_id);

    // New members go to the end unless an explicit position was given.
    let displayOrder = data.display_order;
    if (displayOrder === undefined) {
      const max = await query<RowDataPacket>(
        "SELECT COALESCE(MAX(display_order), 0) AS max_order FROM team_members"
      );
      displayOrder = Number(max[0]?.max_order ?? 0) + 1;
    }

    const result = await execute(
      `INSERT INTO team_members (user_id, name, role, photo_url, bio, linkedin_url, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        data.user_id,
        data.name,
        data.role,
        data.photo_url,
        data.bio ? textToParagraphs(data.bio) : null,
        data.linkedin_url,
        displayOrder,
      ]
    );

    return NextResponse.json({ id: result.insertId }, { status: 201 });
  });
}

const bulkDeleteSchema = z.object({ ids: idsSchema });

export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "team", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids } = parsed.data;
    const result = await execute(
      `DELETE FROM team_members WHERE id IN (${placeholders(ids.length)})`,
      ids
    );

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}
