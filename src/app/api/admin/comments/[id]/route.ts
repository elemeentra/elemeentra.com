import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { parseId } from "@/lib/api-utils";
import { getBlogColumns } from "@/lib/blog-columns";

interface FullCommentRow extends RowDataPacket {
  id: number;
  post_id: number;
  name: string;
  email: string;
  comment_text: string | null;
  approved: number;
  created_at: string | null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "comments", "view");
    const id = parseId(params.id, "comment");

    const rows = await query<FullCommentRow>("SELECT * FROM comments WHERE id = ? LIMIT 1", [id]);
    const comment = rows[0];
    if (!comment) throw new ApiError(404, "Comment not found.");

    return NextResponse.json({ comment: { ...comment, approved: Boolean(comment.approved) } });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "comments", "delete");
    const id = parseId(params.id, "comment");

    const result = await execute("DELETE FROM comments WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Comment not found.");

    return NextResponse.json({ success: true });
  });
}

// Comments are plain text (rendered escaped on the public site), so no HTML
// sanitising is needed here — React escapes on output.
const quickEditSchema = z.object({
  approved: z.boolean().optional(),
  status: z.enum(["pending", "approved", "spam", "trash"]).optional(),
  name: z.string().trim().min(1).max(150).optional(),
  email: z.string().trim().max(150).pipe(z.email()).optional(),
  comment_text: z.string().trim().min(1).max(5000).optional(),
});

/** Moderation quick edit: approve state and light text corrections. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "comments", "approve");
    const id = parseId(params.id, "comment");

    const parsed = quickEditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const data = parsed.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    const cols = await getBlogColumns();
    // `status` wins over the legacy `approved` flag; `approved` always mirrors it.
    const status = data.status ?? (data.approved === undefined ? undefined : data.approved ? "approved" : "pending");
    if (status !== undefined) {
      if (!cols.commentStatus && (status === "spam" || status === "trash")) {
        return NextResponse.json(
          { error: "Spam and Trash need migration 009 (comments.moderation_status)." },
          { status: 400 }
        );
      }
      setClauses.push("approved = ?");
      values.push(status === "approved" ? 1 : 0);
      if (cols.commentStatus) {
        setClauses.push("moderation_status = ?");
        values.push(status);
      }
    }
    if (data.name !== undefined) {
      setClauses.push("name = ?");
      values.push(data.name);
    }
    if (data.email !== undefined) {
      setClauses.push("email = ?");
      values.push(data.email);
    }
    if (data.comment_text !== undefined) {
      setClauses.push("comment_text = ?");
      values.push(data.comment_text);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const result = await execute(
      `UPDATE comments SET ${setClauses.join(", ")} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0) throw new ApiError(404, "Comment not found.");

    return NextResponse.json({ success: true });
  });
}
