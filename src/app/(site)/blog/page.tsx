import Link from "next/link";
import type { Metadata } from "next";
import { Clock } from "lucide-react";
import { PUBLISHED_SQL } from "@/lib/post-visibility";
import { query, type RowDataPacket } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";
import { computeReadTime } from "@/lib/blog-columns";
import { BlogSidebar } from "@/components/site/BlogSidebar";

interface BlogPost extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  author_name: string | null;
  views: number;
  published_at: string | null;
  created_at: string;
  category_names: string | null;
}
interface CountResult extends RowDataPacket { total: number }
interface SlugName extends RowDataPacket { name: string }

const POSTS_PER_PAGE = 10;

interface Filters { q: string; category: string; tag: string; page: number }

async function getPosts({ q, category, tag, page }: Filters) {
  const where: string[] = [PUBLISHED_SQL];
  const params: unknown[] = [];
  if (q) {
    where.push("(title LIKE ? OR excerpt LIKE ? OR content LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category) {
    where.push(`EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id = pc.category_id
                        WHERE pc.post_id = posts.id AND c.slug = ?)`);
    params.push(category);
  }
  if (tag) {
    where.push(`EXISTS (SELECT 1 FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
                        WHERE pt.post_id = posts.id AND t.slug = ?)`);
    params.push(tag);
  }
  const whereSql = where.join(" AND ");
  const offset = (page - 1) * POSTS_PER_PAGE;

  const [posts, countRows] = await Promise.all([
    query<BlogPost>(
      `SELECT id, title, slug, excerpt, content, featured_image, author_name, views, published_at, created_at,
              (SELECT GROUP_CONCAT(c.name SEPARATOR ', ') FROM post_categories pc
                 JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = posts.id) AS category_names
       FROM posts WHERE ${whereSql}
       ORDER BY published_at DESC LIMIT ? OFFSET ?`,
      [...params, POSTS_PER_PAGE, offset]
    ),
    query<CountResult>(`SELECT COUNT(*) AS total FROM posts WHERE ${whereSql}`, params),
  ]);

  const total = countRows[0]?.total ?? 0;
  return { posts, total, totalPages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)) };
}

type SearchParams = { page?: string; q?: string; category?: string; tag?: string };

function clean(v: string | undefined, max = 100) {
  return (v ?? "").trim().slice(0, max);
}

export function generateMetadata({ searchParams }: { searchParams: SearchParams }): Metadata {
  const filtered = Boolean(clean(searchParams.q) || clean(searchParams.category) || clean(searchParams.tag) || searchParams.page);
  return {
    title: "Blog",
    description: "Insights, tips, and stories about web design, WordPress and digital growth.",
    // Search/filter/paginated views are thin duplicates — keep them out of the index.
    ...(filtered && { robots: { index: false, follow: true } }),
  };
}

export default async function BlogPage({ searchParams }: { searchParams: SearchParams }) {
  const q = clean(searchParams.q);
  const category = clean(searchParams.category);
  const tag = clean(searchParams.tag);
  const page = Math.max(1, Number(searchParams.page ?? "1") || 1);

  const { posts, total, totalPages } = await getPosts({ q, category, tag, page });
  const currentPage = Math.min(page, totalPages);

  // Human label for the active filter (category/tag names, not slugs).
  let label = "";
  if (q) label = `Search results for “${q}”`;
  if (category) {
    const r = await query<SlugName>("SELECT name FROM categories WHERE slug = ? LIMIT 1", [category]).catch(() => []);
    label = `Category: ${r[0]?.name ?? category}`;
  } else if (tag) {
    const r = await query<SlugName>("SELECT name FROM tags WHERE slug = ? LIMIT 1", [tag]).catch(() => []);
    label = `Tag: #${r[0]?.name ?? tag}`;
  }

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (category) sp.set("category", category);
    if (tag) sp.set("tag", tag);
    if (p > 1) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `/blog?${s}` : "/blog";
  };

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-border bg-card py-16 md:py-20">
        <div className="container mx-auto px-6">
          <h1 className="mb-4 text-4xl font-bold text-foreground md:text-5xl">Blog</h1>
          <p className="max-w-2xl text-lg text-muted">
            Insights, tips, and stories from our team about web design, development, and digital growth.
          </p>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto grid gap-10 px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div>
            {label && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-foreground">{label}</span> · {total} result{total === 1 ? "" : "s"}
                </p>
                <Link href="/blog" className="text-sm font-medium text-crimson hover:underline">Clear filter</Link>
              </div>
            )}

            {posts.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-lg text-muted">{label ? "No articles matched. Try a different keyword or category." : "No blog posts yet. Check back soon!"}</p>
              </div>
            ) : (
              <>
                <div className="grid gap-8">
                  {posts.map((post) => {
                    const plain = post.content.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                    const excerpt = post.excerpt || plain.substring(0, 200) + (plain.length > 200 ? "…" : "");
                    return (
                      <article key={post.id} className="group overflow-hidden rounded-lg border border-border bg-card transition duration-300 hover:shadow-lg">
                        <Link href={`/blog/${post.slug}`} className="flex h-full flex-col md:flex-row">
                          {post.featured_image && (
                            <div className="h-56 overflow-hidden bg-surface md:h-auto md:w-1/3">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={post.featured_image} alt={post.title} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                            </div>
                          )}
                          <div className="flex flex-1 flex-col justify-between p-6 md:p-8">
                            <div>
                              {post.category_names && (
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-crimson">{post.category_names}</p>
                              )}
                              <h2 className="mb-2 text-2xl font-bold text-foreground transition group-hover:text-crimson">{post.title}</h2>
                              <p className="mb-4 line-clamp-3 text-muted">{excerpt}</p>
                            </div>
                            <div className="flex items-center justify-between border-t border-border pt-4 text-sm text-muted">
                              <div className="flex items-center gap-2">
                                {post.author_name && (<><span className="font-medium text-foreground">{post.author_name}</span><span>•</span></>)}
                                <time dateTime={post.published_at || ""}>{formatDate(post.published_at || post.created_at)}</time>
                              </div>
                              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {computeReadTime(post.content)} min read</span>
                            </div>
                          </div>
                        </Link>
                      </article>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <nav className="mt-12 flex items-center justify-center gap-4" aria-label="Pagination">
                    {currentPage > 1 && (
                      <Link href={pageHref(currentPage - 1)} className="rounded-lg border border-border px-4 py-2 text-foreground transition hover:bg-surface">← Previous</Link>
                    )}
                    <div className="text-sm text-muted">Page {currentPage} of {totalPages}</div>
                    {currentPage < totalPages && (
                      <Link href={pageHref(currentPage + 1)} className="rounded-lg border border-border px-4 py-2 text-foreground transition hover:bg-surface">Next →</Link>
                    )}
                  </nav>
                )}
              </>
            )}
          </div>

          <BlogSidebar activeCategory={category} activeTag={tag} />
        </div>
      </section>
    </main>
  );
}
