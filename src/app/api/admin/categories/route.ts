import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
}

const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
});

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "view");

    const rows = await query<CategoryRow>(
      `SELECT c.id, c.name, c.slug,
              (SELECT COUNT(*) FROM post_categories pc WHERE pc.category_id = c.id) AS post_count
       FROM categories c ORDER BY c.name ASC`
    );
    return NextResponse.json({ categories: rows });
  });
}

export async function POST(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "create");

    const parsed = createCategorySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await query<CategoryRow>(
      "SELECT id, name, slug FROM categories WHERE name = ? LIMIT 1",
      [parsed.data.name]
    );
    if (existing.length > 0) {
      return NextResponse.json({ category: existing[0] }, { status: 200 }); // idempotent
    }

    const slug = await generateUniqueSlug("categories", parsed.data.name);
    const result = await execute("INSERT INTO categories (name, slug) VALUES (?, ?)", [
      parsed.data.name,
      slug,
    ]);

    return NextResponse.json(
      { category: { id: result.insertId, name: parsed.data.name, slug } },
      { status: 201 }
    );
  });
}
