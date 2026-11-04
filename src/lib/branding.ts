import "server-only";
import { loadGeneralSettings } from "@/lib/settings";
import { GENERAL_DEFAULTS } from "@/lib/settings-keys";
import type { BrandProps } from "@/components/brand/BrandLogo";

/** Cached (see settings.ts) — safe to call from every layout. Never throws. */
export async function getBrand(): Promise<BrandProps & { favicon: string | null; tagline: string }> {
  const s = await loadGeneralSettings().catch(() => GENERAL_DEFAULTS);
  return {
    siteName: s.site_name,
    logoUrl: s.site_logo,
    showText: s.logo_show_text,
    favicon: s.site_favicon,
    tagline: s.site_tagline,
  };
}
