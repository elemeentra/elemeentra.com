import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";

interface ReviewRecord extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  rating: number;
  review_title: string | null;
  content: string | null;
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
    const rows = await query<ReviewRecord>(
      "SELECT id, name, email, rating, review_title, review_text AS content, status, featured, created_at FROM reviews WHERE id = ? LIMIT 1",
      [parseId(params.id)]
    );
    const review = rows[0];
    if (!review) throw new ApiError(404, "Review not found.");
    return NextResponse.json({ review: { ...review, featured: Boolean(review.featured) } });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "delete");
    const result = await execute("DELETE FROM reviews WHERE id = ?", [parseId(params.id)]);
    if (result.affectedRows === 0) throw new ApiError(404, "Review not found.");
    return NextResponse.json({ success: true });
  });
}

const quickEditSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  featured: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "edit");
    const parsed = quickEditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    const fields: string[] = [];
    const values: unknown[] = [];
    if (parsed.data.status !== undefined) { fields.push("status = ?"); values.push(parsed.data.status); }
    if (parsed.data.featured !== undefined) { fields.push("featured = ?"); values.push(parsed.data.featured); }
    if (!fields.length) return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    const result = await execute(`UPDATE reviews SET ${fields.join(", ")} WHERE id = ?`, [...values, parseId(params.id)]);
    if (result.affectedRows === 0) throw new ApiError(404, "Review not found.");
    return NextResponse.json({ success: true });
  });
}