import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { query, type RowDataPacket } from "@/lib/db";
import { getFreshSessionCached } from "@/lib/api-auth";
import { sanitizeRichText } from "@/lib/sanitize";
import { formatDate } from "@/lib/date-utils";

// Admin-only preview of any post (draft, pending, scheduled, trashed). Never indexed.
export const metadata: Metadata = {
  title: "Post preview",
  robots: { index: false, follow: false },
};

interface PreviewRow extends RowDataPacket {
  id: number; title: string; slug: string; content: string; excerpt: string | null;
  featured_image: string | null; status: string; published_at: string | null;
  author_name: string | null; created_at: string;
}

export default async function PostPreviewPage({ params }: { params: { id: string } }) {
  // Anyone without blog access just gets a 404 — don't reveal that the route exists.
  const session = await getFreshSessionCached();
  if (!session || !session.permissions?.blog?.includes("view")) notFound();

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const rows = await query<PreviewRow>(
    `SELECT id, title, slug, content, excerpt, featured_image, status, published_at, author_name, created_at
     FROM posts WHERE id = ? LIMIT 1`,
    [id]
  );
  const post = rows[0];
  if (!post) notFound();

  return (
    <main>
      <div className="border-b border-yellow-300 bg-yellow-50 px-6 py-2 text-center text-xs font-semibold text-yellow-900">
        Preview — status: <span className="uppercase">{post.status}</span>. This page is only visible to signed-in admins.
      </div>
      <article className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-black text-foreground md:text-4xl">{post.title || "(untitled)"}</h1>
        <p className="mt-2 text-sm text-muted">
          {post.author_name ? `${post.author_name} · ` : ""}
          {formatDate(post.published_at ?? post.created_at)}
        </p>
        {post.featured_image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.featured_image} alt={post.title} className="mt-6 w-full rounded-2xl border border-border object-cover" />
        )}
        <div
          className="prose mt-8 max-w-none text-foreground dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(post.content) }}
        />
      </article>
    </main>
  );
}
