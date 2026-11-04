import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { PageTracker } from "@/components/site/PageTracker";
import { MobileBottomBar } from "@/components/site/MobileBottomBar";
import { SplashScreen } from "@/components/site/SplashScreen";
import { JsonLd, siteUrl } from "@/components/site/JsonLd";
import { getActiveServices } from "@/lib/site-data";
import { loadGeneralSettings } from "@/lib/settings";
import { GENERAL_DEFAULTS } from "@/lib/settings-keys";

// Public pages read live data (services, projects, posts) — never prerender at build.
export const dynamic = "force-dynamic";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [s, services] = await Promise.all([
    loadGeneralSettings().catch(() => GENERAL_DEFAULTS),
    getActiveServices().catch(() => []),
  ]);
  const brand = { siteName: s.site_name, logoUrl: s.site_logo, showText: s.logo_show_text };
  return (
    <>
      <SplashScreen brand={brand} />
      <JsonLd data={[
        {
          "@context": "https://schema.org", "@type": "Organization",
          name: s.site_name, url: siteUrl(),
          ...(s.contact_email && { email: s.contact_email }),
          ...(s.contact_phone && { telephone: s.contact_phone }),
        },
        { "@context": "https://schema.org", "@type": "WebSite", name: s.site_name, url: siteUrl() },
      ]} />
      <Navbar brand={brand} services={services.map(({ title, slug, short_description }) => ({ title, slug, short_description }))} />
      <div className="min-h-[70vh]">{children}</div>
      <Footer
        brand={brand}
        tagline={s.site_tagline}
        email={s.contact_email}
        phone={s.contact_phone}
        address={s.contact_address}
      />
      <MobileBottomBar />
      <PageTracker />
    </>
  );
}
