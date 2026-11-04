import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, withTransaction, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { generateUniqueSlug } from "@/lib/slugify";
import { sanitizeRichText } from "@/lib/sanitize";
import { toMysqlUtc } from "@/lib/post-visibility";
import { getBlogColumns, computeReadTime } from "@/lib/blog-columns";
import { POST_STATUSES, PUBLISHING_STATUSES } from "@/lib/post-status";
import { calculateSeoScore } from "@/lib/seo-score";

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

export interface PostRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  featured_image: string | null;
  status: "draft" | "pending" | "scheduled" | "published" | "trash";
  published_at: string | null;
  author_id: number;
  created_at: string;
  updated_at: string;
}

const PAGE_SIZE = 20;

interface CountResult extends RowDataPacket {
  total: number;
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "view");

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() ?? "";
    const statusFilter = searchParams.get("status") ?? "";
    const categoryId = Number(searchParams.get("category") ?? "") || 0;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
    const offset = (page - 1) * PAGE_SIZE;

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (search) {
      whereParts.push("(p.title LIKE ? OR p.content LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (statusFilter && (POST_STATUSES as readonly string[]).includes(statusFilter)) {
      whereParts.push("p.status = ?");
      params.push(statusFilter);
    } else {
      // "All" never includes trashed posts (same as WordPress).
      whereParts.push("p.status <> 'trash'");
    }
    if (categoryId > 0) {
      whereParts.push("EXISTS (SELECT 1 FROM post_categories pcf WHERE pcf.post_id = p.id AND pcf.category_id = ?)");
      params.push(categoryId);
    }

    const whereClause = whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    type ListRow = PostRow & {
      slug: string; focus_keyword: string | null; author_name: string | null;
      category_names: string | null; tag_names: string | null; comment_count: number;
    };

    const [countRows, rows, statusRows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM posts p ${whereClause}`, params),
      query<ListRow>(
        `SELECT p.id, p.title, p.slug, p.content, p.meta_title, p.meta_description, p.featured_image,
                p.status, p.published_at, p.scheduled_at, p.author_id, p.author_name, p.focus_keyword,
                p.created_at, p.updated_at,
                (SELECT GROUP_CONCAT(c.name SEPARATOR ', ')
                   FROM post_categories pc JOIN categories c ON c.id = pc.category_id
                  WHERE pc.post_id = p.id) AS category_names,
                (SELECT GROUP_CONCAT(t.name SEPARATOR ', ')
                   FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
                  WHERE pt.post_id = p.id) AS tag_names,
                (SELECT COUNT(*) FROM comments cm WHERE cm.post_id = p.id) AS comment_count
         FROM posts p
         ${whereClause}
         ORDER BY p.created_at DESC, p.id DESC
         LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset]
      ),
      query<RowDataPacket & { status: string; n: number }>(
        "SELECT status, COUNT(*) AS n FROM posts GROUP BY status"
      ),
    ]);

    const total = countRows[0]?.total ?? 0;
    const counts: Record<string, number> = { all: 0, draft: 0, pending: 0, scheduled: 0, published: 0, trash: 0 };
    for (const r of statusRows) {
      counts[r.status] = Number(r.n);
      if (r.status !== "trash") counts.all += Number(r.n);
    }

    return NextResponse.json({
      posts: rows.map(({ content, tag_names, ...r }) => ({
        ...r,
        comment_count: Number(r.comment_count),
        tags: tag_names ? tag_names.split(", ") : [],
        // Same engine as the editor's live SEO panel; no keyword → no score.
        seo_score: r.focus_keyword?.trim()
          ? calculateSeoScore({
              title: r.title,
              seoTitle: r.meta_title ?? "",
              slug: r.slug,
              metaDescription: r.meta_description ?? "",
              content,
              focusKeyword: r.focus_keyword,
            }).score
          : null,
      })),
      counts,
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
    const user = await requirePermission(request, "blog", "create");

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
      ? await generateUniqueSlug("posts", data.slug)
      : await generateUniqueSlug("posts", data.title);

    const postId = await withTransaction(async (conn) => {
      const [result] = await conn.execute<import("mysql2").ResultSetHeader>(
        `INSERT INTO posts (title, slug, excerpt, content, meta_title, meta_description, canonical_url, robots_index, robots_follow, og_image, featured_image, status, published_at, author_id, focus_keyword, faq_schema)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          user.userId,
          data.focus_keyword ?? null,
          data.faq_schema?.length ? JSON.stringify(data.faq_schema) : null,
        ]
      );
      const newId = result.insertId;
      // Optional columns from migration 009 (og_title / og_description / read_time).
      {
        const cols = await getBlogColumns();
        const sets: string[] = [];
        const vals: (string | number | null)[] = [];
        if (cols.ogTitle) { sets.push("og_title = ?"); vals.push(data.og_title?.trim() || null); }
        if (cols.ogDescription) { sets.push("og_description = ?"); vals.push(data.og_description?.trim() || null); }
        if (cols.readTime) { sets.push("read_time = ?"); vals.push(computeReadTime(data.content)); }
        if (sets.length) await conn.execute(`UPDATE posts SET ${sets.join(", ")} WHERE id = ?`, [...vals, newId]);
      }
      for (const categoryId of categoryIds) {
        await conn.execute("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", [newId, categoryId]);
      }
      for (const tagId of tagIds) {
        await conn.execute("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)", [newId, tagId]);
      }
      return newId;
    });

    return NextResponse.json({ id: postId, slug }, { status: 201 });
  });
}

const bulkDeleteSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids } = parsed.data;
    const placeholders = ids.map(() => "?").join(",");

    // Delete tags first
    await execute(`DELETE FROM post_tags WHERE post_id IN (${placeholders})`, ids);
    // Delete posts
    const result = await execute(`DELETE FROM posts WHERE id IN (${placeholders})`, ids);

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

const bulkStatusSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  status: z.enum(POST_STATUSES),
});

export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "blog", "edit");

    const parsed = bulkStatusSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids, status } = parsed.data;
    // Publishing/scheduling needs the "publish" permission, same as the editor.
    if (PUBLISHING_STATUSES.includes(status)) await requirePermission(request, "blog", "publish");

    const placeholders = ids.map(() => "?").join(",");
    // A post marked "published" with no date would stay invisible — stamp it now.
    // "scheduled" needs an existing future date, so rows without one are skipped.
    const setSql =
      status === "published"
        ? "status = 'published', published_at = COALESCE(published_at, UTC_TIMESTAMP())"
        : "status = ?";
    const extraWhere = status === "scheduled" ? " AND published_at IS NOT NULL" : "";
    const result = await execute(
      `UPDATE posts SET ${setSql} WHERE id IN (${placeholders})${extraWhere}`,
      status === "published" ? ids : [status, ...ids]
    );

    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}
