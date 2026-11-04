import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { resolveIcon } from "@/lib/icon-map";
import { sanitizeRichText } from "@/lib/sanitize";
import { getServiceBySlug } from "@/lib/site-data";
import { JsonLd, breadcrumbLd, siteUrl } from "@/components/site/JsonLd";

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = await getServiceBySlug(params.slug).catch(() => null);
  if (!s) return { title: "Service not found" };
  return { title: s.title, description: s.short_description ?? undefined };
}

export default async function ServiceDetailPage({ params }: Props) {
  const s = await getServiceBySlug(params.slug).catch(() => null);
  if (!s) notFound();
  const Icon = resolveIcon(s.icon);

  return (
    <main className="mx-auto max-w-4xl px-6 py-14">
      <JsonLd data={[
        {
          "@context": "https://schema.org", "@type": "Service", name: s.title,
          description: s.short_description ?? undefined,
          url: `${siteUrl()}/services/${s.slug}`,
          provider: { "@type": "Organization", name: "Elemeentra", url: siteUrl() },
        },
        breadcrumbLd([
          { name: "Home", path: "/" }, { name: "Services", path: "/services" },
          { name: s.title, path: `/services/${s.slug}` },
        ]),
      ]} />
      <Link href="/services" className="text-sm text-muted hover:text-crimson">← All services</Link>
      <div className="mt-4 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-crimson-light text-crimson"><Icon className="h-7 w-7" /></div>
        <h1 className="text-3xl font-black text-foreground md:text-4xl">{s.title}</h1>
      </div>
      {s.short_description && <p className="mt-4 text-lg text-muted">{s.short_description}</p>}
      {s.full_description && (
        <div className="prose mt-8 max-w-none text-foreground dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: sanitizeRichText(s.full_description) }} />
      )}
      {s.benefits.length > 0 && (
        <div className="mt-10 rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 font-semibold text-foreground">What you get</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {s.benefits.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm text-foreground"><Check className="mt-0.5 h-4 w-4 shrink-0 text-crimson" />{b}</li>
            ))}
          </ul>
        </div>
      )}
      <Link href="/contact" className="mt-10 inline-block rounded-lg bg-crimson px-6 py-3 text-sm font-semibold text-white transition hover:bg-crimson-hover">Get a Quote for {s.title}</Link>
    </main>
  );
}
