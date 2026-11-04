import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { getBlogColumns } from "@/lib/blog-columns";

const schema = z.object({ text: z.string().trim().min(1, "Reply cannot be empty.").max(2000) });

interface ParentRow extends RowDataPacket { id: number; post_id: number; parent_id?: number | null }

/** Posts an (auto-approved) admin reply under a comment. Replies nest one level deep. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    const session = await requirePermission(request, "comments", "approve");
    const id = Number(params.id);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid comment id.");

    const cols = await getBlogColumns();
    if (!cols.commentParent) {
      return NextResponse.json(
        { error: "Replies need migration 009 (comments.parent_id). Run database/migration/009_blog_parity.sql first." },
        { status: 400 }
      );
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }

    const rows = await query<ParentRow>("SELECT id, post_id, parent_id FROM comments WHERE id = ? LIMIT 1", [id]);
    const parent = rows[0];
    if (!parent) throw new ApiError(404, "Comment not found.");
    // Replying to a reply attaches to the original comment, keeping threads one level deep.
    const rootId = parent.parent_id ?? parent.id;

    const result = await execute(
      `INSERT INTO comments (post_id, name, email, comment_text, parent_id, approved${cols.commentStatus ? ", moderation_status" : ""})
       VALUES (?, ?, ?, ?, ?, TRUE${cols.commentStatus ? ", 'approved'" : ""})`,
      [parent.post_id, session.name, session.email, parsed.data.text, rootId]
    );
    return NextResponse.json({ success: true, id: result.insertId }, { status: 201 });
  });
}
