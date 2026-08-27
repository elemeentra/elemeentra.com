import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";

interface ReviewRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  rating: number;
  content: string | null;
  status: "pending" | "approved" | "rejected";
  featured: number;
  created_at: string;
}

const PAGE_SIZE = 20;
interface CountResult extends RowDataPacket { total: number }

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "view");
    const params = request.nextUrl.searchParams;
    const search = params.get("search")?.trim() ?? "";
    const status = params.get("status") ?? "";
    const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
    const values: unknown[] = [];
    const where: string[] = [];
    if (search) {
      where.push("(name LIKE ? OR email LIKE ? OR review_text LIKE ?)");
      values.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (["pending", "approved", "rejected"].includes(status)) {
      where.push("status = ?");
      values.push(status);
    }
    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (page - 1) * PAGE_SIZE;
    const [countRows, rows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM reviews ${whereClause}`, values),
      query<ReviewRow>(`SELECT id, name, email, rating, review_text AS content, status, featured, created_at FROM reviews ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...values, PAGE_SIZE, offset]),
    ]);
    const total = countRows[0]?.total ?? 0;
    return NextResponse.json({ reviews: rows, pagination: { page, pageSize: PAGE_SIZE, total, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) } });
  });
}

const idsSchema = z.object({ ids: z.array(z.number().int().positive()).min(1) });
export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "delete");
    const parsed = idsSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    const placeholders = parsed.data.ids.map(() => "?").join(",");
    const result = await execute(`DELETE FROM reviews WHERE id IN (${placeholders})`, parsed.data.ids);
    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

const bulkStatusSchema = idsSchema.extend({ status: z.enum(["pending", "approved", "rejected"]) });
export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "reviews", "edit");
    const parsed = bulkStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    const placeholders = parsed.data.ids.map(() => "?").join(",");
    const result = await execute(`UPDATE reviews SET status = ? WHERE id IN (${placeholders})`, [parsed.data.status, ...parsed.data.ids]);
    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}