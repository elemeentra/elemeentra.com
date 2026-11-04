"use client";

import { AlertTriangle } from "lucide-react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Field, FormBanner, SaveBar, Section, inputClass } from "@/components/admin/settings/FormParts";
import { useSettingsForm } from "@/components/admin/settings/useSettingsForm";
import type { SeoSettings } from "@/lib/settings-keys";

const TITLE_SOFT_MAX = 60;
const DESC_SOFT_MAX = 160;

function Counter({ value, soft }: { value: number; soft: number }) {
  return <span className={value > soft ? "font-medium text-crimson" : undefined}>{value}</span>;
}

function hostOf(siteUrl: string): string {
  try {
    return new URL(siteUrl).host;
  } catch {
    return siteUrl;
  }
}

export function SeoSettingsForm({ initial, siteUrl }: { initial: SeoSettings; siteUrl: string }) {
  const { form, update, dirty, saving, error, justSaved, fieldErrors, discard, submit } =
    useSettingsForm<SeoSettings>("/api/admin/settings/seo", initial);

  const innerTitle = form.seo_title_template.includes("%s")
    ? form.seo_title_template.replace("%s", "Sample Page")
    : form.seo_title_template;

  return (
    <form onSubmit={submit}>
      <FormBanner error={error} saved={justSaved} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section
            title="Search Appearance"
            description="Defaults used when a page or post has no SEO title or description of its own."
          >
            <Field
              label="Default Title"
              required
              hint={
                <>
                  <Counter value={form.seo_title.length} soft={TITLE_SOFT_MAX} />/{TITLE_SOFT_MAX} recommended · homepage title
                </>
              }
              error={fieldErrors.seo_title}
            >
              <input
                required
                maxLength={120}
                value={form.seo_title}
                onChange={(e) => update("seo_title", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Title Template"
              required
              hint={'Use %s where the page title goes, e.g. "%s | Elemeentra"'}
              error={fieldErrors.seo_title_template}
            >
              <input
                required
                maxLength={120}
                value={form.seo_title_template}
                onChange={(e) => update("seo_title_template", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Default Meta Description"
              required
              hint={
                <>
                  <Counter value={form.seo_description.length} soft={DESC_SOFT_MAX} />/{DESC_SOFT_MAX} recommended
                </>
              }
              error={fieldErrors.seo_description}
            >
              <textarea
                required
                rows={3}
                maxLength={300}
                value={form.seo_description}
                onChange={(e) => update("seo_description", e.target.value)}
                className={inputClass}
              />
            </Field>
          </Section>

          <Section title="Default Social Image" description="Shown when a page is shared on social media and has no image of its own.">
            <ImageUploader aspect={1.91} cropTitle="Crop social share image" value={form.seo_og_image} onChange={(url) => update("seo_og_image", url)} />
            {fieldErrors.seo_og_image && <p className="text-xs text-crimson">{fieldErrors.seo_og_image}</p>}
            <p className="text-xs text-muted">Recommended size 1200×630 px.</p>
          </Section>

          <Section title="Indexing">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={form.seo_noindex}
                onChange={(e) => update("seo_noindex", e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[var(--crimson)]"
              />
              <span>
                <span className="block text-sm font-medium text-foreground">Discourage search engines from indexing this site</span>
                <span className="block text-xs text-muted">Useful while the site is still being built. Turn it off before launch.</span>
              </span>
            </label>
            {form.seo_noindex && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                When saved, the whole site will ask search engines not to index it, and it won&apos;t appear in Google.
              </div>
            )}
          </Section>

          <SaveBar dirty={dirty} saving={saving} onDiscard={discard} />
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-[calc(var(--topbar-h,88px)+16px)] space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Google Preview</p>
            <SerpCard host={hostOf(siteUrl)} label="Homepage" title={form.seo_title} description={form.seo_description} />
            <SerpCard host={hostOf(siteUrl)} label="Inner page" title={innerTitle} description={form.seo_description} />
          </div>
        </div>
      </div>
    </form>
  );
}

function SerpCard({ host, label, title, description }: { host: string; label: string; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="truncate text-xs text-muted">{host}</p>
      <p className="mt-0.5 line-clamp-2 text-base font-medium leading-snug text-crimson">{title || "Title"}</p>
      <p className="mt-1 line-clamp-3 text-xs text-foreground/80">{description || "Meta description"}</p>
    </div>
  );
}
