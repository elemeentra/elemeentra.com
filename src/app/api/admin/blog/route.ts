import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";
import { sanitizeRichText } from "@/lib/sanitize";

const postSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().optional().default(""),
  excerpt: z.string().optional().nullable(),
  featured_image: z.string().max(255).optional().nullable(),
  category_id: z.number().int().positive().optional().nullable(),
  tag_ids: z.array(z.number().int().positive()).optional().default([]),
  tags: z.array(z.string().min(1).max(100)).optional().default([]),
  meta_title: z.string().max(60).optional().nullable(),
  meta_description: z.string().max(160).optional().nullable(),
  status: z.enum(["draft", "published", "scheduled"]).optional().default("draft"),
  scheduled_at: z.string().datetime().optional().nullable(),
});

export interface BlogRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  featured_image: string | null;
  status: "draft" | "pending" | "scheduled" | "published" | "trash";
  scheduled_at: string | null;
  published_at: string | null;
  category_id: number | null;
  category_name: string | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 20;
const tagIds = (ids: number[]) => [...new Set(ids)];

async function ensureTags(names: string[]) {
  const ids: number[] = [];
  for (const name of [...new Set(names.map((value) => value.trim()).filter(Boolean))]) {
    const existing = await query<RowDataPacket>("SELECT id FROM tags WHERE name = ? LIMIT 1", [name]);
    if (existing[0]) ids.push(Number(existing[0].id));
    else {
      const slug = await generateUniqueSlug("posts", name);
      const result = await execute("INSERT INTO tags (name, slug) VALUES (?, ?)", [name, slug]);
      ids.push(result.insertId);
    }
  }
  return ids;
}

async function connectRelations(postId: number, categoryId: number | null, ids: number[]) {
  await execute("DELETE FROM post_categories WHERE post_id = ?", [postId]);
  await execute("DELETE FROM post_tags WHERE post_id = ?", [postId]);
  if (categoryId) await execute("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [postId, categoryId]);
  for (const tagId of tagIds(ids)) await execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [postId, tagId]);
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "view");
    const params = request.nextUrl.searchParams;
    const search = params.get("search")?.trim() ?? "";
    const status = params.get("status") ?? "";
    const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
    const offset = (page - 1) * PAGE_SIZE;
    const where: string[] = ["p.status != 'trash'"];
    const values: unknown[] = [];
    if (search) { where.push("(p.title LIKE ? OR p.content LIKE ?)"); values.push(`%${search}%`, `%${search}%`); }
    if (["draft", "published", "scheduled"].includes(status)) { where.push("p.status = ?"); values.push(status); }
    const clause = `WHERE ${where.join(" AND ")}`;
    const base = `FROM posts p LEFT JOIN post_categories pc ON pc.post_id = p.id LEFT JOIN categories c ON c.id = pc.category_id LEFT JOIN (SELECT pt.post_id, GROUP_CONCAT(JSON_OBJECT('id', t.id, 'name', t.name) SEPARATOR '||') AS tags FROM post_tags pt JOIN tags t ON t.id = pt.tag_id GROUP BY pt.post_id) tag_data ON tag_data.post_id = p.id ${clause}`;
    const [counts, rows] = await Promise.all([
      query<RowDataPacket>(`SELECT COUNT(DISTINCT p.id) AS total ${base}`, values),
      query<BlogRow>(`SELECT p.id, p.title, p.slug, p.excerpt, p.featured_image, p.status, p.scheduled_at, p.published_at, pc.category_id, c.name AS category_name, tag_data.tags, p.created_at, p.updated_at ${base} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`, [...values, PAGE_SIZE, offset]),
    ]);
    return NextResponse.json({ posts: rows.map((row) => ({ ...row, tags: row.tags ? row.tags.split("||").map((tag) => JSON.parse(tag)) : [] })), pagination: { page, pageSize: PAGE_SIZE, total: Number(counts[0]?.total ?? 0), totalPages: Math.max(1, Math.ceil(Number(counts[0]?.total ?? 0) / PAGE_SIZE)) } });
  });
}

export async function POST(request: NextRequest) {
  return withApiError(async () => {
    const session = await requirePermission(request, "blog", "create");
    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    const data = parsed.data;
    const slug = await generateUniqueSlug("posts", data.title);
    const status = data.status === "published" && !session.permissions.blog?.includes("publish") && session.roleName !== "Super Admin" ? "pending" : data.status;
    const result = await execute("INSERT INTO posts (title, slug, content, excerpt, featured_image, status, author_id, author_name, published_at, scheduled_at, meta_title, meta_description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [data.title, slug, sanitizeRichText(data.content), data.excerpt ?? null, data.featured_image ?? null, status, session.userId, session.name, status === "published" ? new Date() : null, data.scheduled_at ? new Date(data.scheduled_at) : null, data.meta_title ?? null, data.meta_description ?? null]);
    const ids = [...tagIds(data.tag_ids), ...(await ensureTags(data.tags))];
    await connectRelations(result.insertId, data.category_id ?? null, ids);
    return NextResponse.json({ id: result.insertId, slug }, { status: 201 });
  });
}

export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "delete");
    const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    const placeholders = parsed.data.ids.map(() => "?").join(",");
    const result = await execute(`DELETE FROM posts WHERE id IN (${placeholders})`, parsed.data.ids);
    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "edit");
    const parsed = z.object({ ids: z.array(z.number().int().positive()).min(1), status: z.enum(["draft", "published"]) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    const placeholders = parsed.data.ids.map(() => "?").join(",");
    const result = await execute(`UPDATE posts SET status = ?, published_at = IF(? = 'published', COALESCE(published_at, NOW()), NULL) WHERE id IN (${placeholders})`, [parsed.data.status, parsed.data.status, ...parsed.data.ids]);
    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}