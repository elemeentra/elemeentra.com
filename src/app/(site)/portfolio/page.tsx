import type { Metadata } from "next";
import Link from "next/link";
import { getProjects } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Portfolio",
  description: "Selected WordPress, Elementor and WooCommerce projects delivered by Elemeentra.",
};

export default async function PortfolioPage({ searchParams }: { searchParams: { category?: string } }) {
  const all = await getProjects().catch(() => []);
  const categories = Array.from(new Set(all.map((p) => p.category))).sort();
  const active = searchParams.category && categories.includes(searchParams.category) ? searchParams.category : "";
  const projects = active ? all.filter((p) => p.category === active) : all;

  const pill = (on: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
      on ? "border-crimson bg-crimson text-white" : "border-border text-muted hover:border-crimson hover:text-crimson"
    }`;

  return (
    <main>
      <section className="border-b border-border bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-black text-foreground md:text-5xl">Portfolio</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">Websites and stores we&apos;ve built for businesses like yours.</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-12">
        {categories.length > 1 && (
          <div className="mb-8 flex flex-wrap gap-2">
            <Link href="/portfolio" className={pill(!active)}>All</Link>
            {categories.map((c) => (
              <Link key={c} href={`/portfolio?category=${encodeURIComponent(c)}`} className={pill(active === c)}>{c}</Link>
            ))}
          </div>
        )}
        {projects.length === 0 ? (
          <p className="py-12 text-center text-muted">Projects are coming soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/portfolio/${p.slug}`} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:shadow-md">
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.title} className="aspect-[4/3] w-full object-cover" loading="lazy" />
                ) : <div className="aspect-[4/3] w-full bg-surface" />}
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-crimson">{p.category}</p>
                  <h2 className="mt-1 font-semibold text-foreground group-hover:text-crimson">{p.title}</h2>
                  {p.result_summary && <p className="mt-1 text-sm text-muted">{p.result_summary}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
