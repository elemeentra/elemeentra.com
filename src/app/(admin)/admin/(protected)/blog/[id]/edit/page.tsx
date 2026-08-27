import { notFound } from "next/navigation";
import { query, type RowDataPacket } from "@/lib/db";
import { BlogForm, type BlogFormData } from "@/components/admin/blog/BlogForm";

interface PostRow extends RowDataPacket {
	id: number;
	title: string;
	content: string | null;
	excerpt: string | null;
	featured_image: string | null;
	category_id: number | null;
	meta_title: string | null;
	meta_description: string | null;
	status: BlogFormData["status"];
	scheduled_at: string | null;
	tags: string | null;
}

export default async function EditBlogPage({ params }: { params: { id: string } }) {
	const id = Number(params.id);
	if (!Number.isInteger(id) || id <= 0) notFound();
	const rows = await query<PostRow>(`SELECT p.id, p.title, p.content, p.excerpt, p.featured_image, pc.category_id, p.meta_title, p.meta_description, p.status, p.scheduled_at, COALESCE(JSON_ARRAYAGG(CASE WHEN t.id IS NULL THEN NULL ELSE JSON_OBJECT('id', t.id, 'name', t.name) END), JSON_ARRAY()) AS tags FROM posts p LEFT JOIN post_categories pc ON pc.post_id = p.id LEFT JOIN post_tags pt ON pt.post_id = p.id LEFT JOIN tags t ON t.id = pt.tag_id WHERE p.id = ? GROUP BY p.id, pc.category_id`, [id]);
	const post = rows[0];
	if (!post) notFound();
	const tags = typeof post.tags === "string" ? JSON.parse(post.tags).filter(Boolean) : post.tags ?? [];
	const initialData: Partial<BlogFormData> = { title: post.title, content: post.content ?? "", excerpt: post.excerpt ?? "", featured_image: post.featured_image, category_id: post.category_id, tags, meta_title: post.meta_title ?? "", meta_description: post.meta_description ?? "", status: ["draft", "published", "scheduled"].includes(post.status) ? post.status : "draft", scheduled_at: post.scheduled_at };
	return <div><div className="mb-6"><h1 className="text-2xl font-bold">Edit Post</h1><p className="mt-1 text-sm text-muted">{post.title}</p></div><BlogForm mode="edit" postId={post.id} initialData={initialData} /></div>;
}