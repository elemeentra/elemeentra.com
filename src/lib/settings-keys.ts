/**
 * Settings keys, defaults and labels — shared by the API layer, the admin
 * forms and the media-usage scanner. Deliberately free of `server-only` so
 * client components can import it too.
 *
 * Storage: the live `settings` table is key/value (`key_name`, `value`).
 * Nothing in the codebase read it before the Settings module, so every key
 * below is new. A key that was never saved simply has no row — the defaults
 * here (taken from the metadata that used to be hardcoded in app/layout.tsx)
 * apply until the first save.
 */

export type SettingsGroup = "general" | "seo";

export const GENERAL_KEYS = [
  "site_name",
  "site_tagline",
  "contact_email",
  "contact_phone",
  "contact_address",
  "site_logo",
  "logo_show_text",
  "site_favicon",
] as const;

export const SEO_KEYS = [
  "seo_title",
  "seo_title_template",
  "seo_description",
  "seo_og_image",
  "seo_noindex",
] as const;

export type GeneralKey = (typeof GENERAL_KEYS)[number];
export type SeoKey = (typeof SEO_KEYS)[number];

export interface GeneralSettings {
  site_name: string;
  site_tagline: string;
  contact_email: string;
  contact_phone: string;
  contact_address: string;
  site_logo: string | null;
  /** Show the site name next to the logo. When off, the name stays in the DOM as sr-only text for SEO/accessibility. */
  logo_show_text: boolean;
  site_favicon: string | null;
}

export interface SeoSettings {
  seo_title: string;
  seo_title_template: string;
  seo_description: string;
  seo_og_image: string | null;
  seo_noindex: boolean;
}

export const GENERAL_DEFAULTS: GeneralSettings = {
  site_name: "Elemeentra",
  site_tagline: "Web Design, Development & Digital Growth",
  contact_email: "",
  contact_phone: "",
  contact_address: "",
  site_logo: null,
  logo_show_text: true,
  site_favicon: null,
};

export const SEO_DEFAULTS: SeoSettings = {
  seo_title: "Elemeentra — Web Design, Development & Digital Growth",
  seo_title_template: "%s | Elemeentra",
  seo_description:
    "Elemeentra builds, optimizes, and scales WordPress websites, Elementor designs, and WooCommerce stores for growing businesses.",
  seo_og_image: null,
  seo_noindex: false,
};

/** Human labels — used by the Media Library "where is this used" list. */
export const SETTING_LABELS: Record<string, string> = {
  site_name: "Site name",
  site_tagline: "Tagline",
  contact_email: "Contact email",
  contact_phone: "Contact phone",
  contact_address: "Contact address",
  site_logo: "Site logo",
  logo_show_text: "Show site name next to logo",
  site_favicon: "Favicon",
  seo_title: "Default SEO title",
  seo_title_template: "SEO title template",
  seo_description: "Default meta description",
  seo_og_image: "Default social (OG) image",
  seo_noindex: "Hide site from search engines",
};

/** Admin page (relative to the admin base) where a given setting is edited. */
export function settingsPageFor(key: string): string {
  return (SEO_KEYS as readonly string[]).includes(key) ? "settings/seo" : "settings";
}
