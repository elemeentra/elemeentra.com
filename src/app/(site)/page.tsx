import Link from "next/link";
import { ArrowRight, Gauge, Smartphone, Search, ShieldCheck, Star } from "lucide-react";
import { resolveIcon } from "@/lib/icon-map";
import { formatDate } from "@/lib/date-utils";
import {
  getActiveServices, getProjects, getApprovedReviews, getLatestPosts,
} from "@/lib/site-data";

const USPS = [
  { icon: Smartphone, title: "Responsive Design", text: "Pixel-perfect on every phone, tablet and desktop." },
  { icon: Gauge, title: "Fast Loading", text: "Optimised for Core Web Vitals so visitors stay and convert." },
  { icon: Search, title: "SEO Ready", text: "Clean structure and schema so Google can understand you." },
  { icon: ShieldCheck, title: "Secure & Scalable", text: "Hardened builds that grow with your business." },
];

export default async function HomePage() {
  const [services, projects, reviews, posts] = await Promise.all([
    getActiveServices(6).catch(() => []),
    getProjects({ featuredOnly: true, limit: 3 }).catch(() => []),
    getApprovedReviews(3).catch(() => []),
    getLatestPosts(3).catch(() => []),
  ]);

  return (
    <main>
      {/* Hero */}
      <section className="border-b border-border bg-surface">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center md:py-28">
          <h1 className="text-balance text-4xl font-black tracking-tight text-foreground sm:text-5xl md:text-6xl">
            We Build, Optimize &amp; Grow <span className="text-crimson">Your Online Presence.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted md:text-lg">
            Elemeentra is a WordPress &amp; WooCommerce agency founded by Abu Bakar. Fast, SEO-ready websites and
            online stores that turn visitors into customers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/contact" className="rounded-lg bg-crimson px-6 py-3 text-sm font-semibold text-white transition hover:bg-crimson-hover">
              Start Your Project
            </Link>
            <Link href="/portfolio" className="rounded-lg border border-border bg-background px-6 py-3 text-sm font-semibold text-foreground transition hover:border-crimson hover:text-crimson">
              View Our Work
            </Link>
          </div>
        </div>
      </section>

      {/* USPs */}
      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {USPS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-crimson-light text-crimson"><Icon className="h-5 w-5" /></div>
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm text-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      {services.length > 0 && (
        <section className="border-y border-border bg-surface py-14">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mb-8 flex items-end justify-between">
              <h2 className="text-2xl font-black text-foreground md:text-3xl">Our Services</h2>
              <Link href="/services" className="flex items-center gap-1 text-sm font-medium text-crimson hover:underline">All services <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => {
                const Icon = resolveIcon(s.icon);
                return (
                  <Link key={s.id} href={`/services/${s.slug}`} className="group rounded-2xl border border-border bg-background p-6 transition hover:border-crimson/50 hover:shadow-md">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-crimson-light text-crimson"><Icon className="h-5 w-5" /></div>
                    <h3 className="font-semibold text-foreground group-hover:text-crimson">{s.title}</h3>
                    {s.short_description && <p className="mt-1 text-sm text-muted">{s.short_description}</p>}
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* Featured projects */}
      {projects.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-14">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-2xl font-black text-foreground md:text-3xl">Featured Work</h2>
            <Link href="/portfolio" className="flex items-center gap-1 text-sm font-medium text-crimson hover:underline">Full portfolio <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/portfolio/${p.slug}`} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-md">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.title} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ) : <div className="aspect-[4/3] w-full bg-surface" />}
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-crimson">{p.category}</p>
                  <h3 className="mt-1 font-semibold text-foreground group-hover:text-crimson">{p.title}</h3>
                  {p.result_summary && <p className="mt-1 text-sm text-muted">{p.result_summary}</p>}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="border-y border-border bg-surface py-14">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-8 text-2xl font-black text-foreground md:text-3xl">What Clients Say</h2>
            <div className="grid gap-5 md:grid-cols-3">
              {reviews.map((r) => (
                <figure key={r.id} className="rounded-2xl border border-border bg-background p-6">
                  <div className="mb-2 flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-crimson text-crimson" : "text-border"}`} />
                    ))}
                  </div>
                  {r.review_title && <p className="font-semibold text-foreground">{r.review_title}</p>}
                  {r.review_text && <blockquote className="mt-1 text-sm text-muted">{r.review_text}</blockquote>}
                  <figcaption className="mt-3 text-xs font-medium text-foreground">— {r.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Latest blog */}
      {posts.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 py-14">
          <div className="mb-8 flex items-end justify-between">
            <h2 className="text-2xl font-black text-foreground md:text-3xl">From the Blog</h2>
            <Link href="/blog" className="flex items-center gap-1 text-sm font-medium text-crimson hover:underline">All posts <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} className="group rounded-2xl border border-border bg-card p-5 transition hover:border-crimson/50">
                {p.published_at && <p className="text-xs text-muted">{formatDate(p.published_at)}</p>}
                <h3 className="mt-1 font-semibold text-foreground group-hover:text-crimson">{p.title}</h3>
                {p.excerpt && <p className="mt-1 line-clamp-3 text-sm text-muted">{p.excerpt}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl bg-crimson px-6 py-12 text-center text-white">
          <h2 className="text-2xl font-black md:text-3xl">Ready to grow your business online?</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/90">Tell us about your project and get a free, no-obligation quote.</p>
          <Link href="/contact" className="mt-6 inline-block rounded-lg bg-white px-6 py-3 text-sm font-semibold text-crimson transition hover:bg-crimson-light">Get a Free Quote</Link>
        </div>
      </section>
    </main>
  );
}
