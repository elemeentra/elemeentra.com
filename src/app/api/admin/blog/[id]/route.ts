import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, query, type RowDataPacket } from "@/lib/db";
import { ApiError, requirePermission, withApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";
import { sanitizeRichText } from "@/lib/sanitize";

const schema = z.object({
  title: z.string().min(1).max(255), content: z.string().optional().default(""), excerpt: z.string().optional().nullable(), featured_image: z.string().max(255).optional().nullable(), category_id: z.number().int().positive().optional().nullable(), tag_ids: z.array(z.number().int().positive()).optional().default([]), tags: z.array(z.string().min(1).max(100)).optional().default([]), meta_title: z.string().max(60).optional().nullable(), meta_description: z.string().max(160).optional().nullable(), status: z.enum(["draft", "published", "scheduled"]).default("draft"), scheduled_at: z.string().datetime().optional().nullable(),
});

function idOf(raw: string) { const id = Number(raw); if (!Number.isInteger(id) || id < 1) throw new ApiError(400, "Invalid post id."); return id; }

async function getPost(id: number) {
  const rows = await query<RowDataPacket>(`SELECT p.*, pc.category_id, c.name AS category_name, COALESCE(JSON_ARRAYAGG(CASE WHEN t.id IS NULL THEN NULL ELSE JSON_OBJECT('id', t.id, 'name', t.name) END), JSON_ARRAY()) AS tag_data FROM posts p LEFT JOIN post_categories pc ON pc.post_id = p.id LEFT JOIN categories c ON c.id = pc.category_id LEFT JOIN post_tags pt ON pt.post_id = p.id LEFT JOIN tags t ON t.id = pt.tag_id WHERE p.id = ? GROUP BY p.id, pc.category_id, c.name`, [id]);
  const post = rows[0];
  if (!post) throw new ApiError(404, "Post not found.");
  const tags = typeof post.tag_data === "string" ? JSON.parse(post.tag_data) : post.tag_data ?? [];
  return { ...post, tags: tags.filter(Boolean) };
}

async function saveRelations(id: number, categoryId: number | null, tagIds: number[]) {
  await execute("DELETE FROM post_categories WHERE post_id = ?", [id]);
  await execute("DELETE FROM post_tags WHERE post_id = ?", [id]);
  if (categoryId) await execute("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [id, categoryId]);
  for (const tagId of [...new Set(tagIds)]) await execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) { return withApiError(async () => { await requirePermission(request, "blog", "view"); return NextResponse.json({ post: await getPost(idOf(params.id)) }); }); }

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    const session = await requirePermission(request, "blog", "edit"); const id = idOf(params.id); await getPost(id);
    const parsed = schema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: "Invalid input.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    const data = parsed.data; const status = data.status === "published" && session.roleName !== "Super Admin" && !session.permissions.blog?.includes("publish") ? "pending" : data.status; const slug = await generateUniqueSlug("posts", data.title, id);
    await execute("UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, featured_image = ?, status = ?, published_at = ?, scheduled_at = ?, meta_title = ?, meta_description = ? WHERE id = ?", [data.title, slug, sanitizeRichText(data.content), data.excerpt ?? null, data.featured_image ?? null, status, status === "published" ? new Date() : null, data.scheduled_at ? new Date(data.scheduled_at) : null, data.meta_title ?? null, data.meta_description ?? null, id]);
    await saveRelations(id, data.category_id ?? null, data.tag_ids); return NextResponse.json({ id, slug });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) { return withApiError(async () => { await requirePermission(request, "blog", "edit"); const id = idOf(params.id); await getPost(id); const parsed = z.object({ title: z.string().min(1).max(255).optional(), status: z.enum(["draft", "published", "scheduled"]).optional() }).safeParse(await request.json().catch(() => null)); if (!parsed.success || !parsed.data.title && !parsed.data.status) return NextResponse.json({ error: "No valid fields to update." }, { status: 400 }); const sets: string[] = []; const values: unknown[] = []; if (parsed.data.title) { sets.push("title = ?", "slug = ?"); values.push(parsed.data.title, await generateUniqueSlug("posts", parsed.data.title, id)); } if (parsed.data.status) { sets.push("status = ?"); values.push(parsed.data.status); } await execute(`UPDATE posts SET ${sets.join(", ")} WHERE id = ?`, [...values, id]); return NextResponse.json({ success: true }); }); }

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) { return withApiError(async () => { await requirePermission(request, "blog", "delete"); const result = await execute("DELETE FROM posts WHERE id = ?", [idOf(params.id)]); if (!result.affectedRows) throw new ApiError(404, "Post not found."); return NextResponse.json({ success: true }); }); }