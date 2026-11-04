import { notFound } from "next/navigation";
import { PUBLISHED_SQL } from "@/lib/post-visibility";
import { CommentForm } from "@/components/site/CommentForm";
import { CommentThread } from "@/components/site/CommentThread";
import { BlogSidebar } from "@/components/site/BlogSidebar";
import { SocialShare } from "@/components/site/SocialShare";
import { getThreadedComments } from "@/lib/blog-public";
import { computeReadTime } from "@/lib/blog-columns";
import { sanitizeRichText } from "@/lib/sanitize";
import { Clock } from "lucide-react";
import Link from "next/link";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { formatDate } from "@/lib/date-utils";

interface BlogPost extends RowDataPacket {
  id: number;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image: string | null;
  meta_title: string | null;
  meta_description: string | null;
  focus_keyword: string | null;
  og_image: string | null;
  og_title?: string | null;
  og_description?: string | null;
  robots_index?: number | boolean | null;
  robots_follow?: number | boolean | null;
  author_id: number | null;
  canonical_url: string | null;
  author_name: string | null;
  views: number;
  published_at: string | null;
  faq_schema: string | null;
  created_at: string;
}

interface Category extends RowDataPacket {
  name: string;
  slug: string;
}

interface Tag extends RowDataPacket {
  name: string;
  slug: string;
}

// Escape "<" so post text like "</script>" can never break out of the JSON-LD tag.
const ld = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");

async function getPost(slug: string) {
  const rows = await query<BlogPost>(
    `SELECT * FROM posts WHERE slug = ? AND ${PUBLISHED_SQL} LIMIT 1`,
    [slug]
  );

  const post = rows[0];
  if (!post) return null;

  // Increment view count
  await execute("UPDATE posts SET views = views + 1 WHERE id = ?", [post.id]);

  // Get categories
  const categories = await query<Category>(
    `SELECT c.name, c.slug FROM categories c
     INNER JOIN post_categories pc ON c.id = pc.category_id
     WHERE pc.post_id = ?`,
    [post.id]
  );

  // Get tags
  const tags = await query<Tag>(
    `SELECT t.name, t.slug FROM tags t
     INNER JOIN post_tags pt ON t.id = pt.tag_id
     WHERE pt.post_id = ?`,
    [post.id]
  );

  // Author bio/photo for the author box (falls back to the stored author name).
  const authors = post.author_id
    ? await query<RowDataPacket & { name: string; bio: string | null; profile_photo: string | null }>(
        "SELECT name, bio, profile_photo FROM users WHERE id = ? LIMIT 1",
        [post.author_id]
      ).catch(() => [])
    : [];

  return { post, categories, tags, author: authors[0] ?? null };
}

async function getRelatedPosts(postId: number, limit: number = 3) {
  const posts = await query<BlogPost>(
    `SELECT id, title, slug, excerpt, featured_image, author_name, published_at
     FROM posts
     WHERE id != ? AND ${PUBLISHED_SQL}
     ORDER BY published_at DESC
     LIMIT ?`,
    [postId, limit]
  );
  return posts;
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getPost(params.slug);
  if (!data) return {};

  const { post } = data;
  const title = post.meta_title || post.title;
  const description = post.meta_description || post.excerpt || "Read more...";
  const ogTitle = post.og_title || title;
  const ogDescription = post.og_description || description;
  // An explicit social image wins; otherwise the generated per-post card (opengraph-image).
  const ogImages = post.og_image || post.featured_image ? [post.og_image || (post.featured_image as string)] : undefined;

  return {
    title,
    description,
    openGraph: {
      title: ogTitle,
      description: ogDescription,
      type: "article",
      publishedTime: post.published_at,
      authors: post.author_name ? [post.author_name] : [],
      ...(ogImages && { images: ogImages }),
    },
    twitter: { card: "summary_large_image", title: ogTitle, description: ogDescription },
    // noindex / nofollow from the editor's SEO panel (previously ignored).
    robots: { index: Boolean(post.robots_index ?? 1), follow: Boolean(post.robots_follow ?? 1) },
    ...(post.canonical_url && { alternates: { canonical: post.canonical_url } }),
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: { slug: string };
}) {
  const data = await getPost(params.slug);

  if (!data) {
    notFound();
  }

  const { post, categories, tags, author } = data;
  const relatedPosts = await getRelatedPosts(post.id);

  // Parse FAQ schema if available
  let faqSchema: { id: string; question: string; answer: string }[] = [];
  try {
    const raw: unknown = typeof post.faq_schema === "string" ? JSON.parse(post.faq_schema) : post.faq_schema;
    if (Array.isArray(raw)) faqSchema = raw;
  } catch { /* malformed FAQ data → render without FAQ */ }
  const comments = await getThreadedComments(post.id).catch(() => []);
  const readTime = computeReadTime(post.content);

  return (
    <>
      {/* JSON-LD for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.excerpt || post.content.substring(0, 160),
            image: post.featured_image,
            author: {
              "@type": "Person",
              name: post.author_name || "Elemeentra",
            },
            datePublished: post.published_at,
            dateModified: post.published_at,
          }),
        }}
      />

      {/* FAQ Schema if available */}
      {faqSchema.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: ld({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqSchema.map((item: { question: string; answer: string }) => ({
                "@type": "Question",
                name: item.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: item.answer,
                },
              })),
            }),
          }}
        />
      )}

      <main className="min-h-screen bg-background">
        {/* Hero / Featured Image */}
        {post.featured_image && (
          <div className="w-full h-96 overflow-hidden bg-surface">
            <img
              src={post.featured_image}
              alt={post.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Article Content */}
        <div className="container mx-auto grid gap-12 px-6 py-12 md:py-16 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          <div>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-muted mb-8">
              <Link href="/" className="hover:text-foreground transition">
                Home
              </Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-foreground transition">
                Blog
              </Link>
              <span>/</span>
              <span className="text-foreground">{post.title}</span>
            </nav>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              {post.title}
            </h1>

            {/* Meta Information */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted mb-8 pb-8 border-b border-border">
              {post.author_name && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {post.author_name}
                  </span>
                </div>
              )}
              <time dateTime={post.published_at || ""}>
                {formatDate(post.published_at || post.created_at)}
              </time>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {readTime} min read</span>
              {post.views > 0 && (
                <>
                  <span>•</span>
                  <span>{post.views.toLocaleString()} views</span>
                </>
              )}
              <div className="w-full sm:ml-auto sm:w-auto"><SocialShare title={post.title} /></div>
            </div>

            {/* Categories */}
            {categories.length > 0 && (
              <div className="mb-6">
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <Link
                      key={cat.slug}
                      href={`/blog?category=${cat.slug}`}
                      className="inline-block px-3 py-1 rounded-full bg-surface text-sm text-foreground hover:bg-crimson/10 hover:text-crimson transition"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Content */}
            <div
              className="prose dark:prose-invert max-w-none mb-12 text-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeRichText(post.content) }}
            />

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mb-12 pt-8 border-t border-border">
                <p className="text-sm font-medium text-muted mb-3">Tags:</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Link
                      key={tag.slug}
                      href={`/blog?tag=${tag.slug}`}
                      className="inline-block px-2.5 py-1 rounded-full bg-surface text-xs font-medium text-foreground hover:bg-crimson/10 hover:text-crimson transition"
                    >
                      #{tag.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ Section */}
            {faqSchema.length > 0 && (
              <div className="mb-12 pt-8 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground mb-6">
                  Frequently Asked Questions
                </h2>
                <div className="space-y-4">
                  {faqSchema.map((item: { id: string; question: string; answer: string }) => (
                    <details
                      key={item.id}
                      className="group border border-border rounded-lg p-4 cursor-pointer"
                    >
                      <summary className="font-semibold text-foreground group-open:text-crimson transition">
                        {item.question}
                      </summary>
                      <p className="mt-3 text-muted text-sm leading-relaxed">
                        {item.answer}
                      </p>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {/* Author box */}
            {(author?.bio || post.author_name) && (
              <div className="mb-12 flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-start">
                {author?.profile_photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={author.profile_photo} alt={author.name} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                ) : (
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-crimson-light text-lg font-bold text-crimson">
                    {(author?.name ?? post.author_name ?? "E").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground">{author?.name ?? post.author_name}</p>
                  {author?.bio && <p className="mt-1 text-sm leading-relaxed text-muted">{author.bio}</p>}
                </div>
              </div>
            )}
          </div>

        {/* Comments */}
        <section className="border-t border-border pt-12" aria-labelledby="comments-title">
          <div>
            <h2 id="comments-title" className="mb-6 text-2xl font-bold text-foreground">
              Comments{comments.length > 0 ? ` (${comments.length})` : ""}
            </h2>
            <CommentThread comments={comments} />
            <h3 className="mb-3 font-semibold text-foreground">Leave a comment</h3>
            <CommentForm slug={post.slug} />
          </div>
        </section>
        </article>
        <BlogSidebar />
        </div>

        {/* Related Posts */}
        {relatedPosts.length > 0 && (
          <section className="py-12 md:py-16 border-t border-border bg-card">
            <div className="container mx-auto px-6">
              <h2 className="text-3xl font-bold text-foreground mb-8">
                Related Articles
              </h2>
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {relatedPosts.map((relatedPost) => (
                  <Link
                    key={relatedPost.id}
                    href={`/blog/${relatedPost.slug}`}
                    className="group rounded-lg border border-border overflow-hidden hover:shadow-lg transition bg-background"
                  >
                    {relatedPost.featured_image && (
                      <div className="h-40 overflow-hidden bg-surface">
                        <img
                          src={relatedPost.featured_image}
                          alt={relatedPost.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <h3 className="font-semibold text-foreground group-hover:text-crimson transition line-clamp-2">
                        {relatedPost.title}
                      </h3>
                      <p className="text-xs text-muted mt-2">
                        {formatDate(relatedPost.published_at || relatedPost.created_at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* CTA Section */}
        <section className="py-12 md:py-16 bg-surface border-t border-border">
          <div className="container mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
              Ready to transform your digital presence?
            </h2>
            <p className="text-muted mb-6 max-w-2xl mx-auto">
              Let&apos;s discuss how we can help you achieve your goals.
            </p>
            <Link
              href="/contact"
              className="inline-block px-6 py-3 rounded-lg bg-crimson text-white font-semibold hover:bg-crimson-hover transition"
            >
              Get in Touch
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
