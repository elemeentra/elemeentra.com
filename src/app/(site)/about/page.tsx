import type { Metadata } from "next";
import { safeHref } from "@/lib/safe-url";
import Link from "next/link";
import { getTeamMembers } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "About",
  description: "Elemeentra is a WordPress & WooCommerce agency founded by Abu Bakar — meet the team.",
};

export default async function AboutPage() {
  const team = await getTeamMembers().catch(() => []);
  return (
    <main>
      <section className="border-b border-border bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-black text-foreground md:text-5xl">About Elemeentra</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">
            A WordPress &amp; WooCommerce agency founded by Abu Bakar — building fast, SEO-ready websites and stores that help businesses grow online.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-4xl px-6 py-14">
        <h2 className="text-2xl font-black text-foreground">What we do</h2>
        <p className="mt-3 text-muted">
          We design and develop custom WordPress websites, Elementor layouts and WooCommerce stores, then keep them fast,
          secure and up to date. Every project is responsive, optimised for speed, and built with SEO best practices from day one.
        </p>
      </section>
      {team.length > 0 && (
        <section className="border-t border-border bg-surface py-14">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="mb-8 text-2xl font-black text-foreground">Meet the team</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {team.map((m) => (
                <div key={m.id} className="rounded-2xl border border-border bg-background p-5 text-center">
                  {m.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.photo_url} alt={m.name} loading="lazy" className="mx-auto h-24 w-24 rounded-full object-cover" />
                  ) : (
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-crimson-light text-2xl font-black text-crimson">{m.name.charAt(0)}</div>
                  )}
                  <p className="mt-3 font-semibold text-foreground">{m.name}</p>
                  {m.role && <p className="text-xs text-crimson">{m.role}</p>}
                  {m.bio && <p className="mt-2 line-clamp-4 text-sm text-muted">{m.bio}</p>}
                  {safeHref(m.linkedin_url) && (
                    <a href={safeHref(m.linkedin_url) as string} target="_blank" rel="noopener noreferrer" aria-label={`${m.name} on LinkedIn`}
                      className="mt-3 inline-block text-xs font-medium text-muted hover:text-crimson">LinkedIn ↗</a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
      <section className="mx-auto max-w-6xl px-6 py-14 text-center">
        <Link href="/contact" className="inline-block rounded-lg bg-crimson px-6 py-3 text-sm font-semibold text-white transition hover:bg-crimson-hover">Work with us</Link>
      </section>
    </main>
  );
}
