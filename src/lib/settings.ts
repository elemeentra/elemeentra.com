import "server-only";
import { z } from "zod";
import { query, withTransaction, type RowDataPacket } from "@/lib/db";
import { placeholders } from "@/lib/api-utils";
import { optionalEmail, optionalImageUrl, optionalText } from "@/lib/zod-helpers";
import {
  GENERAL_DEFAULTS,
  GENERAL_KEYS,
  SEO_DEFAULTS,
  SEO_KEYS,
  type GeneralSettings,
  type SeoSettings,
  type SettingsGroup,
} from "@/lib/settings-keys";

const requiredText = (label: string, max: number) =>
  z.string().trim().min(1, `${label} is required`).max(max, `${label} must be ${max} characters or fewer`);

export const generalSettingsSchema = z.object({
  site_name: requiredText("Site name", 100),
  site_tagline: optionalText(160),
  contact_email: optionalEmail(150),
  contact_phone: optionalText(40).refine(
    (v) => v === null || /^[+\d\s().-]{5,40}$/.test(v),
    "Enter a valid phone number"
  ),
  contact_address: optionalText(300),
  site_logo: optionalImageUrl(255),
  logo_show_text: z.boolean(),
  site_favicon: optionalImageUrl(255),
});

export const seoSettingsSchema = z.object({
  seo_title: requiredText("Default title", 120),
  seo_title_template: requiredText("Title template", 120).refine(
    (v) => v.includes("%s"),
    'Title template must contain "%s" — the page title is inserted there'
  ),
  seo_description: requiredText("Default description", 300),
  seo_og_image: optionalImageUrl(255),
  seo_noindex: z.boolean(),
});

const GROUPS = {
  general: { keys: GENERAL_KEYS as readonly string[], schema: generalSettingsSchema },
  seo: { keys: SEO_KEYS as readonly string[], schema: seoSettingsSchema },
} as const;

interface SettingRow extends RowDataPacket {
  key_name: string;
  value: string | null;
}

async function readRaw(keys: readonly string[]): Promise<Map<string, string>> {
  const rows = await query<SettingRow>(
    `SELECT key_name, \`value\` FROM settings WHERE key_name IN (${placeholders(keys.length)})`,
    [...keys]
  );
  const map = new Map<string, string>();
  for (const row of rows) if (row.value !== null) map.set(row.key_name, row.value);
  return map;
}

/** Text setting: a missing or blank row falls back to the default. */
function text(raw: Map<string, string>, key: string, fallback: string): string {
  const v = raw.get(key);
  return v !== undefined && v.trim() !== "" ? v : fallback;
}

function image(raw: Map<string, string>, key: string): string | null {
  const v = raw.get(key);
  return v && v.trim() !== "" ? v : null;
}

/** Lenient on read, so a hand-edited "true"/"yes" row still works. */
function flag(raw: Map<string, string>, key: string): boolean {
  return ["1", "true", "yes", "on"].includes((raw.get(key) ?? "").trim().toLowerCase());
}

// Public pages, admin layout, emails and metadata all read the general settings.
// Hitting a remote DB for them on every request is what made pages feel slow, so
// keep a short in-process cache that is cleared the moment settings are saved.
const GENERAL_TTL_MS = 60_000;
let generalCache: { at: number; value: Promise<GeneralSettings> } | null = null;

export function invalidateSettingsCache(): void {
  generalCache = null;
}

export function loadGeneralSettings(): Promise<GeneralSettings> {
  if (generalCache && Date.now() - generalCache.at < GENERAL_TTL_MS) return generalCache.value;
  const value = readGeneral();
  generalCache = { at: Date.now(), value };
  value.catch(() => {
    if (generalCache?.value === value) generalCache = null; // never cache a failure
  });
  return value;
}

async function readGeneral(): Promise<GeneralSettings> {
  const raw = await readRaw(GENERAL_KEYS);
  return {
    site_name: text(raw, "site_name", GENERAL_DEFAULTS.site_name),
    site_tagline: text(raw, "site_tagline", GENERAL_DEFAULTS.site_tagline),
    contact_email: text(raw, "contact_email", ""),
    contact_phone: text(raw, "contact_phone", ""),
    contact_address: text(raw, "contact_address", ""),
    site_logo: image(raw, "site_logo"),
    logo_show_text: raw.has("logo_show_text") ? flag(raw, "logo_show_text") : true,
    site_favicon: image(raw, "site_favicon"),
  };
}

export async function loadSeoSettings(): Promise<SeoSettings> {
  const raw = await readRaw(SEO_KEYS);
  return {
    seo_title: text(raw, "seo_title", SEO_DEFAULTS.seo_title),
    seo_title_template: text(raw, "seo_title_template", SEO_DEFAULTS.seo_title_template),
    seo_description: text(raw, "seo_description", SEO_DEFAULTS.seo_description),
    seo_og_image: image(raw, "seo_og_image"),
    seo_noindex: flag(raw, "seo_noindex"),
  };
}

export function loadSettingsGroup(group: "general"): Promise<GeneralSettings>;
export function loadSettingsGroup(group: "seo"): Promise<SeoSettings>;
export function loadSettingsGroup(group: SettingsGroup): Promise<GeneralSettings | SeoSettings>;
export function loadSettingsGroup(group: SettingsGroup): Promise<GeneralSettings | SeoSettings> {
  return group === "general" ? loadGeneralSettings() : loadSeoSettings();
}

export type SaveSettingsResult =
  | { ok: true; values: GeneralSettings | SeoSettings }
  | { ok: false; issues: Record<string, string[]> };

/**
 * PATCH semantics: only the keys present in `body` are validated and written,
 * so a partial request can never wipe fields it didn't mention. Unknown keys
 * are ignored. An emptied optional field deletes its row (no stale value, and
 * nothing left behind for the Media Library usage scan to find).
 */
export async function saveSettingsGroup(group: SettingsGroup, body: unknown): Promise<SaveSettingsResult> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, issues: { _form: ["Invalid request body."] } };
  }
  const input = body as Record<string, unknown>;
  const { keys, schema } = GROUPS[group];

  const present = keys.filter((k) => Object.prototype.hasOwnProperty.call(input, k));
  if (present.length === 0) {
    return { ok: false, issues: { _form: ["Nothing to update."] } };
  }

  const mask = Object.fromEntries(present.map((k) => [k, true as const]));
  const subset = Object.fromEntries(present.map((k) => [k, input[k]]));
  const parsed = (schema as z.ZodObject<z.ZodRawShape>).pick(mask).safeParse(subset);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.flatten().fieldErrors as Record<string, string[]> };
  }

  const data = parsed.data as Record<string, string | boolean | null>;
  await withTransaction(async (conn) => {
    for (const key of present) {
      const v = data[key];
      if (v === null || v === "") {
        await conn.execute("DELETE FROM settings WHERE key_name = ?", [key]);
        continue;
      }
      const stored = typeof v === "boolean" ? (v ? "1" : "0") : String(v);
      await conn.execute(
        "INSERT INTO settings (key_name, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
        [key, stored]
      );
    }
  });

  invalidateSettingsCache();
  return { ok: true, values: await loadSettingsGroup(group) };
}
