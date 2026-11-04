import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { getBlogColumns } from "@/lib/blog-columns";
import {
  PAGE_SIZE,
  buildPagination,
  getPageParams,
  idsSchema,
  likeTerm,
  placeholders,
} from "@/lib/api-utils";

export interface CommentRow extends RowDataPacket {
  id: number;
  post_id: number;
  post_title: string | null;
  post_slug: string | null;
  name: string;
  email: string;
  comment_text: string | null;
  approved: number;
  moderation_status: "pending" | "approved" | "spam" | "trash";
  parent_id: number | null;
  created_at: string | null;
}

interface CountResult extends RowDataPacket {
  total: number;
}

const STATUSES = ["pending", "approved", "spam", "trash"] as const;
type ModStatus = (typeof STATUSES)[number];

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    const session = await requirePermission(request, "comments", "view");
    const cols = await getBlogColumns();

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const tab = request.nextUrl.searchParams.get("status") ?? "all";
    const { page, offset } = getPageParams(request);

    // Effective status: the real column after migration 009, else derived from `approved`.
    const statusExpr = cols.commentStatus
      ? "c.moderation_status"
      : "(CASE WHEN c.approved = 1 THEN 'approved' ELSE 'pending' END)";
    // "Mine" = comments/replies written by the signed-in admin.
    const mineExpr = "(c.email = ? OR c.name = ?)";

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (search) {
      const like = likeTerm(search);
      whereParts.push("(c.name LIKE ? OR c.email LIKE ? OR c.comment_text LIKE ? OR p.title LIKE ?)");
      params.push(like, like, like, like);
    }
    if (tab === "all") {
      whereParts.push(`${statusExpr} IN ('pending', 'approved')`);
    } else if (tab === "mine") {
      whereParts.push(`${statusExpr} IN ('pending', 'approved') AND ${mineExpr}`);
      params.push(session.email, session.name);
    } else if ((STATUSES as readonly string[]).includes(tab)) {
      whereParts.push(`${statusExpr} = ?`);
      params.push(tab);
    }
    const whereClause = whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    const [countRows, rows, statRows] = await Promise.all([
      query<CountResult>(
        `SELECT COUNT(*) AS total FROM comments c LEFT JOIN posts p ON p.id = c.post_id ${whereClause}`,
        params
      ),
      query<CommentRow>(
        `SELECT c.id, c.post_id, p.title AS post_title, p.slug AS post_slug,
                c.name, c.email, c.comment_text, c.approved, ${statusExpr} AS moderation_status,
                ${cols.commentParent ? "c.parent_id" : "NULL AS parent_id"}, c.created_at
         FROM comments c
         LEFT JOIN posts p ON p.id = c.post_id
         ${whereClause}
         ORDER BY c.created_at DESC, c.id DESC
         LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset]
      ),
      query<RowDataPacket & { st: string; n: number; mine: string | number | null }>(
        `SELECT ${statusExpr} AS st, COUNT(*) AS n, SUM(${mineExpr}) AS mine
         FROM comments c GROUP BY st`,
        [session.email, session.name]
      ),
    ]);

    const counts = { all: 0, mine: 0, pending: 0, approved: 0, spam: 0, trash: 0 };
    for (const r of statRows) {
      const n = Number(r.n);
      if (r.st in counts) counts[r.st as ModStatus] = n;
      if (r.st === "pending" || r.st === "approved") {
        counts.all += n;
        counts.mine += Number(r.mine ?? 0);
      }
    }

    const total = countRows[0]?.total ?? 0;
    return NextResponse.json({
      items: rows.map((r) => ({ ...r, approved: Boolean(r.approved) })),
      pagination: buildPagination(page, total),
      counts,
      // kept for older callers
      stats: { total: counts.all, pending: counts.pending, approved: counts.approved },
      moderationAvailable: cols.commentStatus,
    });
  });
}

const bulkDeleteSchema = z.object({ ids: idsSchema });

export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "comments", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids } = parsed.data;
    const result = await execute(`DELETE FROM comments WHERE id IN (${placeholders(ids.length)})`, ids);

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

const bulkActionSchema = z.union([
  z.object({ ids: idsSchema, status: z.enum(STATUSES) }),
  // legacy shape
  z.object({ ids: idsSchema, action: z.enum(["approve", "unapprove"]) }),
]);

/** Bulk moderation: approve / unapprove / spam / trash / restore. */
export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "comments", "approve");

    const parsed = bulkActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const body = parsed.data;
    const status: ModStatus = "status" in body ? body.status : body.action === "approve" ? "approved" : "pending";

    const cols = await getBlogColumns();
    if (!cols.commentStatus && (status === "spam" || status === "trash")) {
      return NextResponse.json(
        { error: "Spam and Trash need migration 009 (comments.moderation_status). Run database/migration/009_blog_parity.sql first." },
        { status: 400 }
      );
    }

    // `approved` stays the single flag the public site reads.
    const result = await execute(
      `UPDATE comments SET approved = ?${cols.commentStatus ? ", moderation_status = ?" : ""}
       WHERE id IN (${placeholders(body.ids.length)})`,
      cols.commentStatus
        ? [status === "approved" ? 1 : 0, status, ...body.ids]
        : [status === "approved" ? 1 : 0, ...body.ids]
    );

    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}
