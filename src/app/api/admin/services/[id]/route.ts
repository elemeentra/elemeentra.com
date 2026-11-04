import { NextRequest, NextResponse } from "next/server";
import { parseJsonColumn } from "@/lib/json-column";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
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

interface FullServiceRow extends RowDataPacket {
  id: number;
  icon: string | null;
  title: string;
  slug: string;
  short_description: string | null;
  full_description: string | null;
  benefits: string | null;
  status: "active" | "inactive";
  display_order: number;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid service id.");
  return id;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "services", "view");
    const id = parseId(params.id);

    const rows = await query<FullServiceRow>("SELECT * FROM services WHERE id = ? LIMIT 1", [id]);
    const service = rows[0];
    if (!service) throw new ApiError(404, "Service not found.");

    return NextResponse.json({
      service: {
        ...service,
        benefits: parseJsonColumn<string[]>(service.benefits, []),
      },
    });
  });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "services", "edit");
    const id = parseId(params.id);

    const existing = await query<RowDataPacket>("SELECT id FROM services WHERE id = ? LIMIT 1", [id]);
    if (existing.length === 0) throw new ApiError(404, "Service not found.");

    const parsed = serviceSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    const slug = await generateUniqueSlug("services", data.title, id);

    await execute(
      `UPDATE services SET
        icon = ?, title = ?, slug = ?, short_description = ?, full_description = ?,
        benefits = ?, status = ?, display_order = ?
       WHERE id = ?`,
      [
        data.icon ?? null,
        data.title,
        slug,
        data.short_description ?? null,
        sanitizeRichText(data.full_description),
        JSON.stringify(data.benefits ?? []),
        data.status ?? "active",
        data.display_order ?? 0,
        id,
      ]
    );

    return NextResponse.json({ id, slug });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "services", "delete");
    const id = parseId(params.id);

    const result = await execute("DELETE FROM services WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Service not found.");

    return NextResponse.json({ success: true });
  });
}

const quickEditSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  display_order: z.number().int().optional(),
});

/** Partial update for the list page's Quick Edit — only touches the columns sent. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "services", "edit");
    const id = parseId(params.id);

    const parsed = quickEditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const data = parsed.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.title !== undefined) {
      setClauses.push("title = ?");
      values.push(data.title);
    }
    if (data.status !== undefined) {
      setClauses.push("status = ?");
      values.push(data.status);
    }
    if (data.display_order !== undefined) {
      setClauses.push("display_order = ?");
      values.push(data.display_order);
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const result = await execute(
      `UPDATE services SET ${setClauses.join(", ")} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0) throw new ApiError(404, "Service not found.");

    return NextResponse.json({ success: true });
  });
}
