import type { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import { ContactForm } from "@/components/site/ContactForm";
import { loadGeneralSettings } from "@/lib/settings";
import { GENERAL_DEFAULTS } from "@/lib/settings-keys";
import { getActiveServices } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Contact",
  description: "Tell us about your project and get a free quote from Elemeentra.",
};

export default async function ContactPage() {
  const [s, services] = await Promise.all([
    loadGeneralSettings().catch(() => GENERAL_DEFAULTS),
    getActiveServices().catch(() => []),
  ]);

  return (
    <main>
      <section className="border-b border-border bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-black text-foreground md:text-5xl">Contact</h1>
          <p className="mt-3 max-w-2xl text-lg text-muted">Tell us about your project — we reply within one business day.</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-3">
        <div className="lg:col-span-2"><ContactForm services={services.map((x) => x.title)} /></div>
        <aside className="space-y-4 text-sm">
          {s.contact_email && <p className="flex items-center gap-3 text-foreground"><Mail className="h-5 w-5 text-crimson" /><a href={`mailto:${s.contact_email}`} className="hover:text-crimson">{s.contact_email}</a></p>}
          {s.contact_phone && <p className="flex items-center gap-3 text-foreground"><Phone className="h-5 w-5 text-crimson" />{s.contact_phone}</p>}
          {s.contact_address && <p className="flex items-center gap-3 text-foreground"><MapPin className="h-5 w-5 text-crimson" />{s.contact_address}</p>}
          {!s.contact_email && !s.contact_phone && !s.contact_address && (
            <p className="text-muted">Use the form and we&apos;ll get back to you shortly.</p>
          )}
        </aside>
      </section>
    </main>
  );
}
