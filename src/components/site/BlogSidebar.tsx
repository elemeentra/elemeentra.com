import Link from "next/link";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import { getSidebarData } from "@/lib/blog-public";

/** Blog sidebar: search, categories (with counts), recent posts and tags. */
export async function BlogSidebar({ activeCategory, activeTag }: { activeCategory?: string; activeTag?: string }) {
  const { categories, recent, tags } = await getSidebarData();
  const card = "rounded-2xl border border-border bg-card p-5";
  const heading = "mb-3 text-xs font-bold uppercase tracking-wider text-muted";

  return (
    <aside className="space-y-6" aria-label="Blog sidebar">
      <form action="/blog" method="get" role="search" className={card}>
        <label htmlFor="blog-search" className={heading}>Search</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id="blog-search" name="q" type="search" placeholder="Search articles…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson"
          />
        </div>
      </form>

      {categories.length > 0 && (
        <div className={card}>
          <h2 className={heading}>Categories</h2>
          <ul className="space-y-1">
            <li>
              <Link href="/blog" className={`flex justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-surface ${!activeCategory && !activeTag ? "font-semibold text-crimson" : "text-foreground"}`}>
                All posts
              </Link>
            </li>
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/blog?category=${encodeURIComponent(c.slug)}`}
                  className={`flex justify-between rounded-lg px-2 py-1.5 text-sm transition hover:bg-surface ${activeCategory === c.slug ? "font-semibold text-crimson" : "text-foreground"}`}>
                  <span>{c.name}</span><span className="text-muted">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recent.length > 0 && (
        <div className={card}>
          <h2 className={heading}>Recent posts</h2>
          <ul className="space-y-3">
            {recent.map((p) => (
              <li key={p.slug}>
                <Link href={`/blog/${p.slug}`} className="group block">
                  <p className="text-sm font-medium text-foreground group-hover:text-crimson">{p.title}</p>
                  <p className="text-xs text-muted">{formatDate(p.published_at || p.created_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tags.length > 0 && (
        <div className={card}>
          <h2 className={heading}>Tags</h2>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <Link key={t.slug} href={`/blog?tag=${encodeURIComponent(t.slug)}`}
                className={`rounded-full border px-2.5 py-1 text-xs transition hover:border-crimson hover:text-crimson ${activeTag === t.slug ? "border-crimson text-crimson" : "border-border text-foreground"}`}>
                #{t.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
