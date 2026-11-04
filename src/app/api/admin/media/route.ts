import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { PAGE_SIZE, buildPagination, getPageParams, likeTerm } from "@/lib/api-utils";
import { deleteMedia, findMediaUsage } from "@/lib/media-usage";

export interface MediaListRow extends RowDataPacket {
  id: number;
  filename: string;
  file_url: string;
  thumbnail_url: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  uploaded_by: number | null;
  uploaded_at: string | null;
  uploader_name: string | null;
}

interface StatsRow extends RowDataPacket {
  total: number;
  total_size: string | number | null;
  this_month: string | number | null;
}

interface CountResult extends RowDataPacket {
  total: number;
}

const LARGE_FILE_BYTES = 500 * 1024;

const filterSchema = z.enum(["", "mine", "month", "large"]).catch("");

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    const session = await requirePermission(request, "media", "view");

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const filter = filterSchema.parse(request.nextUrl.searchParams.get("status") ?? "");
    const { page, offset } = getPageParams(request);

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (search) {
      const like = likeTerm(search);
      whereParts.push("(m.filename LIKE ? OR u.name LIKE ?)");
      params.push(like, like);
    }
    if (filter === "mine") {
      whereParts.push("m.uploaded_by = ?");
      params.push(session.userId);
    } else if (filter === "month") {
      whereParts.push("m.uploaded_at >= DATE_FORMAT(NOW(), '%Y-%m-01')");
    } else if (filter === "large") {
      whereParts.push("m.file_size > ?");
      params.push(LARGE_FILE_BYTES);
    }

    const whereClause = whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    const [countRows, rows, statsRows] = await Promise.all([
      query<CountResult>(
        `SELECT COUNT(*) AS total FROM media m LEFT JOIN users u ON u.id = m.uploaded_by ${whereClause}`,
        params
      ),
      // blur_placeholder is deliberately NOT selected — it's only useful to the
      // public site's next/image and would just bloat the admin list payload.
      query<MediaListRow>(
        `SELECT m.id, m.filename, m.file_url, m.thumbnail_url, m.file_size, m.width, m.height,
                m.uploaded_by, m.uploaded_at, u.name AS uploader_name
         FROM media m
         LEFT JOIN users u ON u.id = m.uploaded_by
         ${whereClause}
         ORDER BY m.uploaded_at DESC, m.id DESC
         LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset]
      ),
      query<StatsRow>(
        `SELECT COUNT(*) AS total,
                SUM(file_size) AS total_size,
                SUM(uploaded_at >= DATE_FORMAT(NOW(), '%Y-%m-01')) AS this_month
         FROM media`
      ),
    ]);

    const usage = await findMediaUsage(rows);
    const total = countRows[0]?.total ?? 0;
    const s = statsRows[0];

    return NextResponse.json({
      items: rows.map((r) => ({ ...r, usage_count: usage.get(r.id)?.length ?? 0 })),
      pagination: buildPagination(page, total),
      stats: {
        total: Number(s?.total ?? 0),
        totalSize: Number(s?.total_size ?? 0),
        thisMonth: Number(s?.this_month ?? 0),
      },
    });
  });
}

// Capped lower than the other modules: each id triggers a usage scan across
// posts/projects/etc., so a smaller IN (...) list keeps that query light.
const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(50),
  force: z.boolean().optional().default(false),
});

/**
 * Bulk delete. Without `force`, responds 409 + the usage list if any selected
 * file is still referenced (nothing is deleted); the UI warns, then retries
 * with `force: true`.
 */
export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "media", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const result = await deleteMedia(parsed.data.ids, parsed.data.force);
    if (!result.ok) {
      return NextResponse.json(
        { error: "Some selected files are still in use.", inUse: result.inUse },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, deleted: result.deleted, fileErrors: result.fileErrors });
  });
}
