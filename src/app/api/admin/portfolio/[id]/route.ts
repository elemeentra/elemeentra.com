import { NextRequest, NextResponse } from "next/server";
import { parseJsonColumn } from "@/lib/json-column";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
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
  project_url: z
    .string()
    .max(255)
    .optional()
    .nullable()
    .refine((v) => !v || /^https?:\/\//i.test(v), { message: "Project URL must start with http:// or https://" }),
  results: z.string().optional().nullable(),
  featured: z.boolean().optional().default(false),
  display_order: z.number().int().optional().default(0),
});

interface FullProjectRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  category: string;
  client_name: string | null;
  description: string | null;
  challenge: string | null;
  solution: string | null;
  result_summary: string | null;
  image_url: string | null;
  gallery_images: string | null;
  tech_tags: string | null;
  project_url: string | null;
  results: string | null;
  featured: number;
  display_order: number;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid project id.");
  return id;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "portfolio", "view");
    const id = parseId(params.id);

    const rows = await query<FullProjectRow>("SELECT * FROM projects WHERE id = ? LIMIT 1", [id]);
    const project = rows[0];
    if (!project) throw new ApiError(404, "Project not found.");

    return NextResponse.json({
      project: {
        ...project,
        gallery_images: parseJsonColumn<string[]>(project.gallery_images, []),
        tech_tags: parseJsonColumn<string[]>(project.tech_tags, []),
        featured: Boolean(project.featured),
      },
    });
  });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "portfolio", "edit");
    const id = parseId(params.id);

    const existing = await query<RowDataPacket>("SELECT id, title FROM projects WHERE id = ? LIMIT 1", [id]);
    if (existing.length === 0) throw new ApiError(404, "Project not found.");

    const parsed = projectSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const slug = await generateUniqueSlug("projects", data.title, id);

    await execute(
      `UPDATE projects SET
        title = ?, slug = ?, category = ?, client_name = ?, description = ?, challenge = ?,
        solution = ?, result_summary = ?, image_url = ?, gallery_images = ?, tech_tags = ?,
        project_url = ?, results = ?, featured = ?, display_order = ?
       WHERE id = ?`,
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
        id,
      ]
    );

    return NextResponse.json({ id, slug });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "portfolio", "delete");
    const id = parseId(params.id);

    const result = await execute("DELETE FROM projects WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Project not found.");

    return NextResponse.json({ success: true });
  });
}

const quickEditSchema = z.object({
  category: z.string().min(1).max(100).optional(),
  client_name: z.string().max(150).nullable().optional(),
  display_order: z.number().int().optional(),
  featured: z.boolean().optional(),
});

/**
 * Partial update for the list page's "Quick Edit" — only touches the
 * columns actually sent, unlike PUT which replaces the entire row. This
 * matters: Quick Edit only exposes category/client/order/featured, so a
 * full-row PUT would silently wipe description/challenge/gallery/etc.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "portfolio", "edit");
    const id = parseId(params.id);

    const parsed = quickEditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const data = parsed.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.category !== undefined) {
      setClauses.push("category = ?");
      values.push(data.category);
    }
    if (data.client_name !== undefined) {
      setClauses.push("client_name = ?");
      values.push(data.client_name);
    }
    if (data.display_order !== undefined) {
      setClauses.push("display_order = ?");
      values.push(data.display_order);
    }
    if (data.featured !== undefined) {
      setClauses.push("featured = ?");
      values.push(data.featured);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const result = await execute(
      `UPDATE projects SET ${setClauses.join(", ")} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0) throw new ApiError(404, "Project not found.");

    return NextResponse.json({ success: true });
  });
}
