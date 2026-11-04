import type { Metadata } from "next";
import { safeHref } from "@/lib/safe-url";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { sanitizeRichText } from "@/lib/sanitize";
import { getProjectBySlug } from "@/lib/site-data";
import { JsonLd, breadcrumbLd, siteUrl } from "@/components/site/JsonLd";

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await getProjectBySlug(params.slug).catch(() => null);
  if (!p) return { title: "Project not found" };
  return {
    title: p.title,
    description: p.result_summary ?? undefined,
    openGraph: p.image_url ? { images: [p.image_url] } : undefined,
  };
}

function Block({ title, html }: { title: string; html: string | null }) {
  if (!html) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-bold text-foreground">{title}</h2>
      <div className="prose max-w-none text-foreground dark:prose-invert" dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }} />
    </section>
  );
}

export default async function ProjectDetailPage({ params }: Props) {
  const p = await getProjectBySlug(params.slug).catch(() => null);
  if (!p) notFound();

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <JsonLd data={[
        {
          "@context": "https://schema.org", "@type": "CreativeWork", name: p.title,
          description: p.result_summary ?? undefined, image: p.image_url ?? undefined,
          url: `${siteUrl()}/portfolio/${p.slug}`,
          creator: { "@type": "Organization", name: "Elemeentra" },
        },
        breadcrumbLd([
          { name: "Home", path: "/" }, { name: "Portfolio", path: "/portfolio" },
          { name: p.title, path: `/portfolio/${p.slug}` },
        ]),
      ]} />
      <Link href="/portfolio" className="text-sm text-muted hover:text-crimson">← All projects</Link>
      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-crimson">{p.category}</p>
      <h1 className="mt-1 text-3xl font-black text-foreground md:text-4xl">{p.title}</h1>
      {p.client_name && <p className="mt-2 text-sm text-muted">Client: {p.client_name}</p>}
      {p.result_summary && <p className="mt-4 text-lg text-muted">{p.result_summary}</p>}

      {p.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={p.image_url} alt={p.title} className="mt-8 w-full rounded-2xl border border-border object-cover" />
      )}

      {p.tech_tags.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {p.tech_tags.map((t) => (
            <span key={t} className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-foreground">{t}</span>
          ))}
        </div>
      )}

      <Block title="Overview" html={p.description} />
      <Block title="The Challenge" html={p.challenge} />
      <Block title="Our Solution" html={p.solution} />
      <Block title="Results" html={p.results} />

      {p.gallery_images.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-xl font-bold text-foreground">Gallery</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {p.gallery_images.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" className="w-full rounded-xl border border-border object-cover" loading="lazy" />
            ))}
          </div>
        </section>
      )}

      <div className="mt-12 flex flex-wrap gap-3">
        {safeHref(p.project_url) && (
          <a href={safeHref(p.project_url) as string} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-border px-5 py-2.5 text-sm font-semibold text-foreground transition hover:border-crimson hover:text-crimson">
            Visit live site <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <Link href="/contact" className="rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover">Start a similar project</Link>
      </div>
    </main>
  );
}
