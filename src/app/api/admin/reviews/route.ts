import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { getReviewColumns } from "@/lib/reviews-schema";
import { requirePermission, withApiError } from "@/lib/api-auth";

export interface ReviewRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  rating: number;
  content: string;
  status: "pending" | "approved" | "rejected";
  featured: number;
  created_at: string;
}

const PAGE_SIZE = 20;

interface CountResult extends RowDataPacket {
  total: number;
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "view");
    const col = await getReviewColumns();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const statusFilter = searchParams.get("status") ?? "";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (search) {
      whereParts.push(`(name LIKE ? OR email LIKE ? OR ${col.text} LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (statusFilter && ["pending", "approved", "rejected"].includes(statusFilter)) {
      whereParts.push("status = ?");
      params.push(statusFilter);
    }

    const whereClause = whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    const [countRows, rows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM reviews ${whereClause}`, params),
      query<ReviewRow>(
        `SELECT id, name, email, rating, ${col.text} AS content, status, ${col.featured ? "featured" : "0 AS featured"}, created_at
         FROM reviews
         ${whereClause}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset]
      ),
    ]);

    const total = countRows[0]?.total ?? 0;

    return NextResponse.json({
      reviews: rows,
      featuredSupported: col.featured,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    });
  });
}

const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids } = parsed.data;
    const placeholders = ids.map(() => "?").join(",");
    const result = await execute(`DELETE FROM reviews WHERE id IN (${placeholders})`, ids);

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

const bulkStatusSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  status: z.enum(["pending", "approved", "rejected"]),
});

/** Bulk change status — used by the Bulk Actions dropdown. */
export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "edit");

    const parsed = bulkStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids, status } = parsed.data;
    const placeholders = ids.map(() => "?").join(",");
    const result = await execute(
      `UPDATE reviews SET status = ? WHERE id IN (${placeholders})`,
      [status, ...ids]
    );

    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}
