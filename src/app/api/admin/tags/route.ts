import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";

interface TagRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
}

const createTagSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
});

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "view");

    const search = request.nextUrl.searchParams.get("search")?.trim();

    const rows = search
      ? await query<TagRow>(
          "SELECT id, name, slug FROM tags WHERE name LIKE ? ORDER BY name ASC LIMIT 20",
          [`%${search}%`]
        )
      : await query<TagRow>("SELECT id, name, slug FROM tags ORDER BY name ASC LIMIT 50");

    return NextResponse.json({ tags: rows });
  });
}

export async function POST(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "create");

    const parsed = createTagSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await query<TagRow>("SELECT id, name, slug FROM tags WHERE name = ? LIMIT 1", [
      parsed.data.name,
    ]);
    if (existing.length > 0) {
      return NextResponse.json({ tag: existing[0] }, { status: 200 }); // idempotent
    }

    const slug = await generateUniqueSlug("tags", parsed.data.name);
    const result = await execute("INSERT INTO tags (name, slug) VALUES (?, ?)", [
      parsed.data.name,
      slug,
    ]);

    return NextResponse.json({ tag: { id: result.insertId, name: parsed.data.name, slug } }, { status: 201 });
  });
}
