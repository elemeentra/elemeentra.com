import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";
import { sanitizeRichText, textToParagraphs } from "@/lib/sanitize";

const projectSchema = z.object({
  title: z.string().min(1, "Title is required").max(150),
  category: z.string().min(1, "Category is required").max(100),
  client_name: z.string().max(150).optional().nullable(),
  description: z.string().optional().nullable(),
  challenge: z.string().optional().nullable(),
  solution: z.string().optional().nullable(),
  result_summary: z.string().max(255).optional().nullable(),
  image_url: z.string().max(255).optional().nullable(),
  gallery_images: z.array(z.string()).optional().default([]),
  tech_tags: z.array(z.string()).optional().default([]),
  project_url: z.string().max(255).optional().nullable(),
  results: z.string().optional().nullable(),
  featured: z.boolean().optional().default(false),
  display_order: z.number().int().optional().default(0),
});

export interface ProjectRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  category: string;
  client_name: string | null;
  image_url: string | null;
  featured: number;
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
    await requirePermission(request, "portfolio", "view");

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const whereClause = search ? "WHERE title LIKE ? OR category LIKE ? OR client_name LIKE ?" : "";
    const searchParamsList = search ? [`%${search}%`, `%${search}%`, `%${search}%`] : [];

    const [countRows, rows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM projects ${whereClause}`, searchParamsList),
      query<ProjectRow>(
        `SELECT id, title, slug, category, client_name, image_url, featured, display_order, created_at, updated_at
         FROM projects
         ${whereClause}
         ORDER BY display_order ASC, created_at DESC
         LIMIT ? OFFSET ?`,
        [...searchParamsList, PAGE_SIZE, offset]
      ),
    ]);

    const total = countRows[0]?.total ?? 0;

    return NextResponse.json({
      projects: rows,
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
    await requirePermission(request, "portfolio", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids } = parsed.data;
    const placeholders = ids.map(() => "?").join(",");
    const result = await execute(`DELETE FROM projects WHERE id IN (${placeholders})`, ids);

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

const bulkFeaturedSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  featured: z.boolean(),
});

/** Bulk toggle the "featured" flag — used by the list page's WordPress-style Bulk Actions dropdown. */
export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "portfolio", "edit");

    const parsed = bulkFeaturedSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids, featured } = parsed.data;
    const placeholders = ids.map(() => "?").join(",");
    const result = await execute(
      `UPDATE projects SET featured = ? WHERE id IN (${placeholders})`,
      [featured, ...ids]
    );

    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}

export async function POST(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "portfolio", "create");

    const parsed = projectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const slug = await generateUniqueSlug("projects", data.title);

    const result = await execute(
      `INSERT INTO projects
        (title, slug, category, client_name, description, challenge, solution, result_summary,
         image_url, gallery_images, tech_tags, project_url, results, featured, display_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.title,
        slug,
        data.category,
        data.client_name ?? null,
        sanitizeRichText(data.description),
        textToParagraphs(data.challenge),
        textToParagraphs(data.solution),
        data.result_summary ?? null,
        data.image_url ?? null,
        JSON.stringify(data.gallery_images ?? []),
        JSON.stringify(data.tech_tags ?? []),
        data.project_url ?? null,
        textToParagraphs(data.results),
        data.featured ?? false,
        data.display_order ?? 0,
      ]
    );

    return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
  });
}
