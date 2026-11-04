import type { Metadata } from "next";
import Link from "next/link";
import { resolveIcon } from "@/lib/icon-map";
import { getActiveServices } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Services",
  description: "WordPress development, Elementor design, WooCommerce stores, speed optimization, maintenance and more.",
};

export default async function ServicesPage() {
  const services = await getActiveServices().catch(() => []);
  return (
    <main>
      <section className="border-b border-border bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-black text-foreground md:text-5xl">Services</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">Everything you need to launch, speed up and grow a WordPress website.</p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-14">
        {services.length === 0 ? (
          <p className="py-12 text-center text-muted">Services are coming soon.</p>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => {
              const Icon = resolveIcon(s.icon);
              return (
                <Link key={s.id} href={`/services/${s.slug}`} className="group rounded-2xl border border-border bg-card p-6 transition hover:border-crimson/50 hover:shadow-md">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-crimson-light text-crimson"><Icon className="h-5 w-5" /></div>
                  <h2 className="font-semibold text-foreground group-hover:text-crimson">{s.title}</h2>
                  {s.short_description && <p className="mt-1 text-sm text-muted">{s.short_description}</p>}
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
