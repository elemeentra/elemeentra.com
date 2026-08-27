"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, X } from "lucide-react";
import { IconPicker } from "@/components/admin/IconPicker";
import { RichTextEditor } from "@/components/admin/RichTextEditor";
import { resolveIcon } from "@/lib/icon-map";
import { useAdminBase } from "@/lib/use-admin-base";

export interface ServiceFormData {
  icon: string;
  title: string;
  short_description: string;
  full_description: string;
  benefits: string[];
  status: "active" | "inactive";
  display_order: number;
}

const EMPTY_FORM: ServiceFormData = {
  icon: "",
  title: "",
  short_description: "",
  full_description: "",
  benefits: [],
  status: "active",
  display_order: 0,
};

interface ServiceFormProps {
  mode: "create" | "edit";
  serviceId?: number;
  initialData?: Partial<ServiceFormData>;
}

export function ServiceForm({ mode, serviceId, initialData }: ServiceFormProps) {
  const router = useRouter();
  const adminBase = useAdminBase();
  const [form, setForm] = useState<ServiceFormData>({ ...EMPTY_FORM, ...initialData });
  const [benefitDraft, setBenefitDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ServiceFormData>(key: K, value: ServiceFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function addBenefit() {
    const trimmed = benefitDraft.trim();
    if (!trimmed) return;
    update("benefits", [...form.benefits, trimmed]);
    setBenefitDraft("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const url = mode === "create" ? "/api/admin/services" : `/api/admin/services/${serviceId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }

      router.push(`${adminBase}/services`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-5 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Basic Information">
            <Field label="Icon" hint="Search and pick from the curated icon set">
              <IconPicker value={form.icon} onChange={(v) => update("icon", v)} />
            </Field>
            <Field label="Service Title" required>
              <input
                required
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                className={inputClass}
                placeholder="WooCommerce Store Development"
              />
            </Field>
            <Field label="Short Description" hint="Shown on the services grid card">
              <textarea
                value={form.short_description}
                onChange={(e) => update("short_description", e.target.value)}
                rows={2}
                maxLength={255}
                className={inputClass}
                placeholder="A one-line summary of this service."
              />
            </Field>
          </Section>

          <Section title="Full Description" hint="Shown on the service's detail page. Supports images.">
            <RichTextEditor
              value={form.full_description}
              onChange={(html) => update("full_description", html)}
              placeholder="Describe this service in detail…"
              minHeight={180}
              allowImages
            />
          </Section>

          <Section title="Benefits" hint="Bullet points shown on the service card/page">
            <div className="space-y-2">
              {form.benefits.map((benefit, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                    {benefit}
                  </span>
                  <button
                    type="button"
                    onClick={() => update("benefits", form.benefits.filter((_, idx) => idx !== i))}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={benefitDraft}
                onChange={(e) => setBenefitDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addBenefit();
                  }
                }}
                placeholder="e.g. Mobile-optimized checkout"
                className={inputClass}
              />
              <button
                type="button"
                onClick={addBenefit}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-crimson text-white transition hover:bg-crimson-hover"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </Section>

          <Section title="Visibility & Ordering">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => update("status", e.target.value as "active" | "inactive")}
                  className={inputClass}
                >
                  <option value="active">Active — visible on site</option>
                  <option value="inactive">Inactive — hidden</option>
                </select>
              </Field>
              <Field label="Display Order">
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => update("display_order", Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create Service" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`${adminBase}/services`)}
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Live Preview</p>
            <PreviewCard form={form} />
          </div>
        </div>
      </div>
    </form>
  );
}

function PreviewCard({ form }: { form: ServiceFormData }) {
  const Icon = resolveIcon(form.icon);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-crimson-light text-crimson">
          <Icon className="h-5 w-5" />
        </div>
        {form.status === "inactive" && (
          <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted">Hidden</span>
        )}
      </div>

      <h3 className="text-base font-bold leading-snug text-foreground">
        {form.title || <span className="text-muted">Service title…</span>}
      </h3>

      <p className="mt-1.5 text-sm text-foreground/80">
        {form.short_description || <span className="text-muted">Short description preview…</span>}
      </p>

      {form.benefits.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {form.benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
              <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-crimson" />
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-crimson";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-crimson">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
