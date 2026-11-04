import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { getReviewColumns } from "@/lib/reviews-schema";

interface FullReviewRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  rating: number;
  content: string;
  status: "pending" | "approved" | "rejected";
  featured: number;
  created_at: string;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid review id.");
  return id;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "view");
    const id = parseId(params.id);

    const col = await getReviewColumns();
    const rows = await query<FullReviewRow>(
      `SELECT id, name, email, rating, ${col.text} AS content, status,
              ${col.featured ? "featured" : "0 AS featured"}, created_at
       FROM reviews WHERE id = ? LIMIT 1`,
      [id]
    );
    const review = rows[0];
    if (!review) throw new ApiError(404, "Review not found.");

    return NextResponse.json({
      review: {
        ...review,
        featured: Boolean(review.featured),
      },
    });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "delete");
    const id = parseId(params.id);

    const result = await execute("DELETE FROM reviews WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Review not found.");

    return NextResponse.json({ success: true });
  });
}

const quickEditSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  featured: z.boolean().optional(),
});

/** Update review status and/or featured flag. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "edit");
    const id = parseId(params.id);

    const parsed = quickEditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const data = parsed.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.status !== undefined) {
      setClauses.push("status = ?");
      values.push(data.status);
    }
    if (data.featured !== undefined) {
      if (!(await getReviewColumns()).featured) {
        return NextResponse.json(
          { error: "Featured is unavailable: the database user is not allowed to add the `featured` column. Run database/migration/010_reviews_featured.sql once in phpMyAdmin." },
          { status: 400 }
        );
      }
      setClauses.push("featured = ?");
      values.push(data.featured);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const result = await execute(
      `UPDATE reviews SET ${setClauses.join(", ")} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0) throw new ApiError(404, "Review not found.");

    return NextResponse.json({ success: true });
  });
}
