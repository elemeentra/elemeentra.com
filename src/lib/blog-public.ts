import "server-only";
import { query, type RowDataPacket } from "@/lib/db";
import { PUBLISHED_SQL, publishedSqlFor } from "@/lib/post-visibility";
import { getBlogColumns } from "@/lib/blog-columns";

export interface SidebarCategory { name: string; slug: string; count: number }
export interface SidebarTag { name: string; slug: string; count: number }
export interface SidebarPost { title: string; slug: string; published_at: string | null; created_at: string }

type CatRow = RowDataPacket & SidebarCategory;
type TagRow = RowDataPacket & SidebarTag;
type PostRow = RowDataPacket & SidebarPost;

/** Categories (with published-post counts), recent posts and popular tags for the blog sidebar. */
export async function getSidebarData() {
  const [categories, recent, tags] = await Promise.all([
    query<CatRow>(
      `SELECT c.name, c.slug, COUNT(p.id) AS count
       FROM categories c
       JOIN post_categories pc ON pc.category_id = c.id
       JOIN posts p ON p.id = pc.post_id AND ${publishedSqlFor("p")}
       GROUP BY c.id, c.name, c.slug
       ORDER BY count DESC, c.name ASC
       LIMIT 20`
    ).catch(() => [] as CatRow[]),
    query<PostRow>(
      `SELECT title, slug, published_at, created_at FROM posts
       WHERE ${PUBLISHED_SQL} ORDER BY published_at DESC LIMIT 5`
    ).catch(() => [] as PostRow[]),
    query<TagRow>(
      `SELECT t.name, t.slug, COUNT(p.id) AS count
       FROM tags t
       JOIN post_tags pt ON pt.tag_id = t.id
       JOIN posts p ON p.id = pt.post_id AND ${publishedSqlFor("p")}
       GROUP BY t.id, t.name, t.slug
       ORDER BY count DESC, t.name ASC
       LIMIT 20`
    ).catch(() => [] as TagRow[]),
  ]);
  return {
    categories: categories.map((c) => ({ ...c, count: Number(c.count) })),
    recent,
    tags: tags.map((t) => ({ ...t, count: Number(t.count) })),
  };
}

export interface ThreadComment {
  id: number;
  name: string;
  comment_text: string | null;
  created_at: string | null;
  parent_id: number | null;
}
type CommentRow = RowDataPacket & ThreadComment;

/** Approved comments for a post, including admin replies (parent_id) once migration 009 is applied. */
export async function getThreadedComments(postId: number): Promise<ThreadComment[]> {
  const cols = await getBlogColumns();
  return query<CommentRow>(
    `SELECT id, name, comment_text, created_at, ${cols.commentParent ? "parent_id" : "NULL AS parent_id"}
     FROM comments WHERE post_id = ? AND approved = TRUE ORDER BY created_at ASC LIMIT 200`,
    [postId]
  );
}
