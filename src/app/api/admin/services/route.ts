import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";
import { sanitizeRichText } from "@/lib/sanitize";

const serviceSchema = z.object({
  icon: z.string().max(100).optional().nullable(),
  title: z.string().min(1, "Title is required").max(150),
  short_description: z.string().max(255).optional().nullable(),
  full_description: z.string().optional().nullable(),
  benefits: z.array(z.string()).optional().default([]),
  status: z.enum(["active", "inactive"]).optional().default("active"),
  display_order: z.number().int().optional().default(0),
});

export interface ServiceRow extends RowDataPacket {
  id: number;
  icon: string | null;
  title: string;
  slug: string;
  short_description: string | null;
  status: "active" | "inactive";
  display_order: number;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 20;

interface CountResult extends RowDataPacket {
  total: number;
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "services", "view");

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const whereClause = search ? "WHERE title LIKE ? OR short_description LIKE ?" : "";
    const searchParamsList = search ? [`%${search}%`, `%${search}%`] : [];

    const [countRows, rows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM services ${whereClause}`, searchParamsList),
      query<ServiceRow>(
        `SELECT id, icon, title, slug, short_description, status, display_order, created_at, updated_at
         FROM services
         ${whereClause}
         ORDER BY display_order ASC, created_at DESC
         LIMIT ? OFFSET ?`,
        [...searchParamsList, PAGE_SIZE, offset]
      ),
    ]);

    const total = countRows[0]?.total ?? 0;

    return NextResponse.json({
      services: rows,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      },
    });
  });
}

export async function POST(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "services", "create");

    const parsed = serviceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const slug = await generateUniqueSlug("services", data.title);

    const result = await execute(
      `INSERT INTO services (icon, title, slug, short_description, full_description, benefits, status, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.icon ?? null,
        data.title,
        slug,
        data.short_description ?? null,
        sanitizeRichText(data.full_description),
        JSON.stringify(data.benefits ?? []),
        data.status ?? "active",
        data.display_order ?? 0,
      ]
    );

    return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
  });
}

const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "services", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids } = parsed.data;
    const placeholders = ids.map(() => "?").join(",");
    const result = await execute(`DELETE FROM services WHERE id IN (${placeholders})`, ids);

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

const bulkStatusSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  status: z.enum(["active", "inactive"]),
});

/** Bulk activate/deactivate — used by the list page's Bulk Actions dropdown. */
export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "services", "edit");

    const parsed = bulkStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids, status } = parsed.data;
    const placeholders = ids.map(() => "?").join(",");
    const result = await execute(
      `UPDATE services SET status = ? WHERE id IN (${placeholders})`,
      [status, ...ids]
    );

    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}
