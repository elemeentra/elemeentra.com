"use client";

import Image from "next/image";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { Field, FormBanner, SaveBar, Section, inputClass } from "@/components/admin/settings/FormParts";
import { useSettingsForm } from "@/components/admin/settings/useSettingsForm";
import type { GeneralSettings } from "@/lib/settings-keys";

export function GeneralSettingsForm({ initial }: { initial: GeneralSettings }) {
  const { form, update, dirty, saving, error, justSaved, fieldErrors, discard, submit } =
    useSettingsForm<GeneralSettings>("/api/admin/settings", initial);

  return (
    <form onSubmit={submit}>
      <FormBanner error={error} saved={justSaved} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Site Identity" description="Used across the public site and in emails.">
            <Field label="Site Name" required error={fieldErrors.site_name}>
              <input
                required
                maxLength={100}
                value={form.site_name}
                onChange={(e) => update("site_name", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field
              label="Tagline"
              hint={`${form.site_tagline.length}/160 characters`}
              error={fieldErrors.site_tagline}
            >
              <input
                maxLength={160}
                value={form.site_tagline}
                onChange={(e) => update("site_tagline", e.target.value)}
                className={inputClass}
                placeholder="A short line describing what you do"
              />
            </Field>
          </Section>

          <Section title="Contact Details" description="Shown in the footer and on the contact page.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Contact Email" error={fieldErrors.contact_email}>
                <input
                  type="email"
                  maxLength={150}
                  value={form.contact_email}
                  onChange={(e) => update("contact_email", e.target.value)}
                  className={inputClass}
                  placeholder="hello@example.com"
                />
              </Field>
              <Field label="Contact Phone" error={fieldErrors.contact_phone}>
                <input
                  type="tel"
                  maxLength={40}
                  value={form.contact_phone}
                  onChange={(e) => update("contact_phone", e.target.value)}
                  className={inputClass}
                  placeholder="+92 300 0000000"
                />
              </Field>
            </div>
            <Field
              label="Address"
              hint={`${form.contact_address.length}/300 characters · plain text`}
              error={fieldErrors.contact_address}
            >
              <textarea
                rows={3}
                maxLength={300}
                value={form.contact_address}
                onChange={(e) => update("contact_address", e.target.value)}
                className={inputClass}
              />
            </Field>
          </Section>

          <SaveBar dirty={dirty} saving={saving} onDiscard={discard} />
        </div>

        <div className="space-y-6 lg:col-span-1">
          <Section title="Logo">
            <ImageUploader contain cropTitle="Crop logo" value={form.site_logo} onChange={(url) => update("site_logo", url)} />
            {fieldErrors.site_logo && <p className="text-xs text-crimson">{fieldErrors.site_logo}</p>}
            <p className="text-xs text-muted">PNG, JPG or WebP. A transparent PNG works best. Appears automatically in the website header, footer, loading screen and this dashboard.</p>

            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface p-3">
              <input
                type="checkbox"
                checked={form.logo_show_text}
                onChange={(e) => update("logo_show_text", e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-crimson"
              />
              <span>
                <span className="block text-sm font-semibold text-foreground">Show site name next to the logo</span>
                <span className="block text-xs text-muted">
                  Turn off to show only the logo. The name stays in the page as hidden text so search engines and screen readers still read it.
                </span>
              </span>
            </label>
          </Section>

          <Section title="Favicon">
            <ImageUploader compact aspect={1} cropTitle="Crop favicon" value={form.site_favicon} onChange={(url) => update("site_favicon", url)} />
            {fieldErrors.site_favicon && <p className="text-xs text-crimson">{fieldErrors.site_favicon}</p>}
            <p className="text-xs text-muted">Square image, at least 64×64 px.</p>
          </Section>

          <div className="sticky top-[calc(var(--topbar-h,88px)+16px)]">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Brand Preview</p>
            <BrandPreview form={form} />
          </div>
        </div>
      </div>
    </form>
  );
}

function BrandPreview({ form }: { form: GeneralSettings }) {
  const brand = { siteName: form.site_name || "Site name", logoUrl: form.site_logo, showText: form.logo_show_text };
  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="rounded-xl border border-border bg-white px-4 py-3">
        <BrandLogo {...brand} size={34} textClassName="text-base font-black tracking-tight text-[#17151a]" />
      </div>
      <div className="rounded-xl bg-[#1a0f12] px-4 py-3">
        <BrandLogo {...brand} size={34} textClassName="text-base font-black tracking-tight text-white" />
      </div>
      <p className="truncate text-xs text-muted">{form.site_tagline || "Tagline"}</p>
      {form.site_favicon && (
        <div className="flex items-center gap-2 text-xs text-muted">
          <span className="relative block h-6 w-6 overflow-hidden rounded">
            <Image src={form.site_favicon} alt="" fill className="object-cover" unoptimized />
          </span>
          Favicon
        </div>
      )}
    </div>
  );
}
