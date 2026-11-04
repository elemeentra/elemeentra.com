import { notFound } from "next/navigation";
import { parseJsonColumn } from "@/lib/json-column";
import { query, type RowDataPacket } from "@/lib/db";
import { AdvancedBlogForm, type AdvancedBlogFormData } from "@/components/admin/blog/AdvancedBlogForm";
import { type FaqItem } from "@/components/admin/blog/FaqSchemaBuilder";

interface FullPostRow extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  robots_index: number | boolean;
  robots_follow: number | boolean;
  og_image: string | null;
  og_title?: string | null;
  og_description?: string | null;
  featured_image: string | null;
  status: "draft" | "pending" | "published" | "scheduled" | "trash";
  published_at: string | null;
  author_id: number | null;
  focus_keyword: string | null;
  faq_schema: string | null;
  created_at: string;
  updated_at: string;
}

interface TagRow extends RowDataPacket {
  id: number;
}

export default async function EditPostPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await query<FullPostRow>("SELECT * FROM posts WHERE id = ? LIMIT 1", [id]);
  const post = rows[0];
  if (!post) notFound();

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

  const faqSchema: FaqItem[] = parseJsonColumn<FaqItem[]>(post.faq_schema, []);

  const initialData: Partial<AdvancedBlogFormData> = {
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? "",
    content: post.content,
    meta_title: post.meta_title ?? "",
    meta_description: post.meta_description ?? "",
    canonical_url: post.canonical_url ?? "",
    robots_index: Boolean(post.robots_index),
    robots_follow: Boolean(post.robots_follow),
    og_image: post.og_image ?? "",
    og_title: post.og_title ?? "",
    og_description: post.og_description ?? "",
    featured_image: post.featured_image ?? "",
    category_ids,
    tags,
    // a trashed post reopens as a draft (restore + edit)
    status: post.status === "trash" ? "draft" : post.status,
    published_at: post.published_at ?? "",
    author_id: post.author_id,
    focus_keyword: post.focus_keyword ?? "",
    faq_schema: faqSchema,
  };

  return <AdvancedBlogForm mode="edit" postId={post.id} initialData={initialData} />;
}
