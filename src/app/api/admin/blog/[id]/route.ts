import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, withTransaction, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";
import { sanitizeRichText } from "@/lib/sanitize";
import { toMysqlUtc } from "@/lib/post-visibility";
import { getBlogColumns, computeReadTime } from "@/lib/blog-columns";
import { POST_STATUSES, PUBLISHING_STATUSES } from "@/lib/post-status";

const postSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().max(255).optional().nullable(),
  excerpt: z.string().max(500).optional().nullable(),
  content: z.string().min(1),
  meta_title: z.string().max(60).optional().nullable(),
  meta_description: z.string().max(160).optional().nullable(),
  canonical_url: z.string().max(255).optional().nullable(),
  robots_index: z.boolean().optional().default(true),
  robots_follow: z.boolean().optional().default(true),
  og_image: z.string().max(255).optional().nullable(),
  og_title: z.string().max(255).optional().nullable(),
  og_description: z.string().max(500).optional().nullable(),
  category_ids: z.array(z.number().int().positive()).optional().default([]),
  tags: z.array(z.number().int().positive()).optional().default([]),
  status: z.enum(POST_STATUSES).optional().default("draft"),
  published_at: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || !Number.isNaN(Date.parse(v)), { message: "Invalid date" })
    .transform((v) => (v ? toMysqlUtc(v) : null)),
  featured_image: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\//.test(v) || v.startsWith("/"), { message: "Invalid URL" }),
  author_id: z.number().int().positive().optional().nullable(),
  focus_keyword: z.string().max(150).optional().nullable(),
  faq_schema: z.array(z.object({ id: z.string(), question: z.string(), answer: z.string() })).optional().default([]),
});

interface FullPostRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  featured_image: string | null;
  status: "draft" | "published" | "scheduled";
  published_at: string | null;
  author_id: number;
  created_at: string;
  updated_at: string;
}

interface TagRow extends RowDataPacket {
  id: number;
}

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid post id.");
  return id;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "view");
    const id = parseId(params.id);

    const rows = await query<FullPostRow>("SELECT * FROM posts WHERE id = ? LIMIT 1", [id]);
    const post = rows[0];
    if (!post) throw new ApiError(404, "Post not found.");

    const tagRows = await query<TagRow>(
      `SELECT t.id FROM tags t
       INNER JOIN post_tags pt ON t.id = pt.tag_id
       WHERE pt.post_id = ?`,
      [id]
    );
    const tags = tagRows.map((r) => r.id);

    const categoryRows = await query<TagRow>(
      `SELECT c.id FROM categories c
       INNER JOIN post_categories pc ON c.id = pc.category_id
       WHERE pc.post_id = ?`,
      [id]
    );
    const category_ids = categoryRows.map((r) => r.id);

    return NextResponse.json({ post: { ...post, tags, category_ids } });
  });
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "edit");
    const id = parseId(params.id);

    const existing = await query<RowDataPacket>("SELECT id FROM posts WHERE id = ? LIMIT 1", [id]);
    if (existing.length === 0) throw new ApiError(404, "Post not found.");

    const parsed = postSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", issues: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const data = parsed.data;
    // Publishing (or scheduling) needs the "publish" permission — "create"/"edit"
    // alone may only save drafts. Without this a Contributor could self-publish.
    if (PUBLISHING_STATUSES.includes(data.status)) await requirePermission(request, "blog", "publish");

    let publishedAt = data.published_at ?? null;
    if (data.status === "published" && !publishedAt) publishedAt = toMysqlUtc(new Date());
    if (data.status === "scheduled" && !publishedAt) {
      return NextResponse.json({ error: "Choose a date and time to schedule this post." }, { status: 400 });
    }
    const categoryIds = Array.from(new Set(data.category_ids ?? []));
    const tagIds = Array.from(new Set(data.tags ?? []));
    const slug = data.slug?.trim()
      ? await generateUniqueSlug("posts", data.slug, id)
      : await generateUniqueSlug("posts", data.title, id);

    await withTransaction(async (conn) => {
      await conn.execute(
        `UPDATE posts SET
          title = ?, slug = ?, excerpt = ?, content = ?, meta_title = ?, meta_description = ?,
          canonical_url = ?, robots_index = ?, robots_follow = ?, og_image = ?,
          featured_image = ?, status = ?, published_at = ?, author_id = ?, focus_keyword = ?, faq_schema = ?
         WHERE id = ?`,
        [
          data.title,
          slug,
          data.excerpt ?? null,
          sanitizeRichText(data.content),
          data.meta_title ?? null,
          data.meta_description ?? null,
          data.canonical_url ?? null,
          data.robots_index ?? true,
          data.robots_follow ?? true,
          data.og_image ?? null,
          data.featured_image ?? null,
          data.status ?? "draft",
          publishedAt,
          data.author_id ?? null,
          data.focus_keyword ?? null,
          data.faq_schema?.length ? JSON.stringify(data.faq_schema) : null,
          id,
        ]
      );

      // Optional columns from migration 009 (og_title / og_description / read_time).
      {
        const cols = await getBlogColumns();
        const sets: string[] = [];
        const vals: (string | number | null)[] = [];
        if (cols.ogTitle) { sets.push("og_title = ?"); vals.push(data.og_title?.trim() || null); }
        if (cols.ogDescription) { sets.push("og_description = ?"); vals.push(data.og_description?.trim() || null); }
        if (cols.readTime) { sets.push("read_time = ?"); vals.push(computeReadTime(data.content)); }
        if (sets.length) await conn.execute(`UPDATE posts SET ${sets.join(", ")} WHERE id = ?`, [...vals, id]);
      }
      // Replace categories/tags atomically so a bad id can't leave a post half-updated.
      await conn.execute("DELETE FROM post_categories WHERE post_id = ?", [id]);
      for (const categoryId of categoryIds) {
        await conn.execute("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [id, categoryId]);
      }
      await conn.execute("DELETE FROM post_tags WHERE post_id = ?", [id]);
      for (const tagId of tagIds) {
        await conn.execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [id, tagId]);
      }
    });

    return NextResponse.json({ id, slug });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "delete");
    const id = parseId(params.id);

    // Delete tags first
    await execute("DELETE FROM post_tags WHERE post_id = ?", [id]);
    // Delete post
    const result = await execute("DELETE FROM posts WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Post not found.");

    return NextResponse.json({ success: true });
  });
}

const quickEditSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  status: z.enum(POST_STATUSES).optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "edit");
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
      if (PUBLISHING_STATUSES.includes(data.status)) await requirePermission(request, "blog", "publish");
      if (data.status === "scheduled") {
        const row = await query<RowDataPacket & { published_at: string | null }>(
          "SELECT published_at FROM posts WHERE id = ? LIMIT 1", [id]
        );
        if (!row[0]) throw new ApiError(404, "Post not found.");
        if (!row[0].published_at) {
          return NextResponse.json({ error: "Open the post and choose a date to schedule it." }, { status: 400 });
        }
      }
      setClauses.push("status = ?");
      values.push(data.status);
      // Published with no date would never appear on the site — stamp it now.
      if (data.status === "published") setClauses.push("published_at = COALESCE(published_at, UTC_TIMESTAMP())");
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const result = await execute(
      `UPDATE posts SET ${setClauses.join(", ")} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0) throw new ApiError(404, "Post not found.");

    return NextResponse.json({ success: true });
  });
}
