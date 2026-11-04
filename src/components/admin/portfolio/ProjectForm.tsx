"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Star, ExternalLink, ImageOff } from "lucide-react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import dynamic from "next/dynamic";
import { useAdminBase } from "@/lib/use-admin-base";

// Tiptap is large — load it only when the form opens, not with the page shell.
const RichTextEditor = dynamic(() => import("@/components/admin/RichTextEditor").then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-lg bg-surface" aria-hidden />,
});


export interface ProjectFormData {
  title: string;
  category: string;
  client_name: string;
  description: string;
  challenge: string;
  solution: string;
  result_summary: string;
  image_url: string | null;
  gallery_images: string[];
  tech_tags: string[];
  project_url: string;
  results: string;
  featured: boolean;
  display_order: number;
}

const EMPTY_FORM: ProjectFormData = {
  title: "",
  category: "",
  client_name: "",
  description: "",
  challenge: "",
  solution: "",
  result_summary: "",
  image_url: null,
  gallery_images: [],
  tech_tags: [],
  project_url: "",
  results: "",
  featured: false,
  display_order: 0,
};

interface ProjectFormProps {
  mode: "create" | "edit";
  projectId?: number;
  initialData?: Partial<ProjectFormData>;
}

export function ProjectForm({ mode, projectId, initialData }: ProjectFormProps) {
  const router = useRouter();
  const adminBase = useAdminBase();
  const [form, setForm] = useState<ProjectFormData>({ ...EMPTY_FORM, ...initialData });
  const [techTagsInput, setTechTagsInput] = useState(initialData?.tech_tags?.join(", ") ?? "");
  const [galleryUrlDraft, setGalleryUrlDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ProjectFormData>(key: K, value: ProjectFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const payload = {
      ...form,
      tech_tags: techTagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    try {
      const url = mode === "create" ? "/api/admin/portfolio" : `/api/admin/portfolio/${projectId}`;
      const method = mode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }

      router.push(`${adminBase}/portfolio`);
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
        {/* Main form column */}
        <div className="space-y-6 lg:col-span-2">
          <Section title="Basic Information">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Project Title" required>
                <input
                  required
                  value={form.title}
                  onChange={(e) => update("title", e.target.value)}
                  className={inputClass}
                  placeholder="Acme Corp — E-commerce Redesign"
                />
              </Field>
              <Field label="Category" required>
                <input
                  required
                  value={form.category}
                  onChange={(e) => update("category", e.target.value)}
                  className={inputClass}
                  placeholder="WooCommerce Store"
                />
              </Field>
              <Field label="Client Name">
                <input
                  value={form.client_name}
                  onChange={(e) => update("client_name", e.target.value)}
                  className={inputClass}
                  placeholder="Acme Corp"
                />
              </Field>
              <Field label="Project URL">
                <input
                  value={form.project_url}
                  onChange={(e) => update("project_url", e.target.value)}
                  className={inputClass}
                  placeholder="https://example.com"
                />
              </Field>
            </div>
          </Section>

          <Section title="Cover Image">
            <ImageUploader
              label=""
              value={form.image_url}
              onChange={(url) => update("image_url", url)}
              aspect={16 / 9}
              cropTitle="Crop cover image"
            />
          </Section>

          <Section title="Description" hint="Shown on the portfolio grid card. Supports images.">
            <RichTextEditor
              value={form.description}
              onChange={(html) => update("description", html)}
              placeholder="A one/two-line summary shown on the portfolio grid."
              minHeight={110}
              allowImages
            />
          </Section>

          <Section title="Case Study">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="The Challenge" hint="Blank line = new paragraph">
                <textarea
                  value={form.challenge}
                  onChange={(e) => update("challenge", e.target.value)}
                  rows={5}
                  className={inputClass}
                />
              </Field>
              <Field label="The Solution" hint="Blank line = new paragraph">
                <textarea
                  value={form.solution}
                  onChange={(e) => update("solution", e.target.value)}
                  rows={5}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field label="Results" hint="Blank line = new paragraph">
              <textarea
                value={form.results}
                onChange={(e) => update("results", e.target.value)}
                rows={3}
                className={inputClass}
                placeholder="e.g. 40% increase in conversion rate within 3 months."
              />
            </Field>
            <Field label="Result Summary" hint="Short badge shown on the card, e.g. '+40% conversions'">
              <input
                value={form.result_summary}
                onChange={(e) => update("result_summary", e.target.value)}
                className={inputClass}
                maxLength={255}
              />
            </Field>
          </Section>

          <Section title="Gallery">
            <div className="flex flex-wrap gap-3">
              {form.gallery_images.map((url, i) => (
                <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        "gallery_images",
                        form.gallery_images.filter((_, idx) => idx !== i)
                      )
                    }
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-crimson text-[10px] text-white opacity-0 shadow transition group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
              <div className="w-24">
                <ImageUploader
                  label=""
                  value={galleryUrlDraft}
                  onChange={(url) => {
                    if (url) update("gallery_images", [...form.gallery_images, url]);
                    setGalleryUrlDraft(null);
                  }}
                  compact
                />
              </div>
            </div>
          </Section>

          <Section title="Tags & Ordering">
            <Field label="Tech Tags" hint="Comma-separated">
              <input
                value={techTagsInput}
                onChange={(e) => setTechTagsInput(e.target.value)}
                className={inputClass}
                placeholder="WordPress, Elementor, WooCommerce"
              />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Display Order">
                <input
                  type="number"
                  value={form.display_order}
                  onChange={(e) => update("display_order", Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-2 self-end pb-2.5">
                <input
                  type="checkbox"
                  checked={form.featured}
                  onChange={(e) => update("featured", e.target.checked)}
                  className="h-4 w-4 rounded border-border accent-crimson"
                />
                <span className="text-sm font-medium text-foreground">Featured project</span>
              </label>
            </div>
          </Section>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create Project" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`${adminBase}/portfolio`)}
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Live preview column */}
        <div className="lg:col-span-1">
          <div className="sticky top-[calc(var(--topbar-h,88px)+16px)]">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Live Preview</p>
            <PreviewCard form={form} />
          </div>
        </div>
      </div>
    </form>
  );
}

function PreviewCard({ form }: { form: ProjectFormData }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative aspect-[4/3] w-full bg-surface">
        {form.image_url ? (
          <Image src={form.image_url} alt="" fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        {form.featured && (
          <div className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-crimson px-2.5 py-1 text-[11px] font-semibold text-white shadow">
            <Star className="h-3 w-3 fill-current" />
            Featured
          </div>
        )}
      </div>

      <div className="p-4">
        {form.category && (
          <span className="mb-1.5 inline-block rounded-full bg-crimson-light px-2.5 py-0.5 text-[11px] font-medium text-crimson">
            {form.category}
          </span>
        )}

        <h3 className="text-base font-bold leading-snug text-foreground">
          {form.title || <span className="text-muted">Project title…</span>}
        </h3>

        {form.client_name && <p className="mt-0.5 text-xs text-muted">for {form.client_name}</p>}

        {form.description ? (
          <div
            className="prose prose-sm mt-2.5 max-w-none text-foreground/80 [&_img]:rounded-md [&_p]:my-1"
            dangerouslySetInnerHTML={{ __html: form.description }}
          />
        ) : (
          <p className="mt-2.5 text-sm text-muted">Description preview will appear here…</p>
        )}

        {form.result_summary && (
          <p className="mt-3 inline-block rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-foreground">
            {form.result_summary}
          </p>
        )}

        {form.tech_tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {form.tech_tags.map((tag, i) => (
              <span key={i} className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted">
                {tag}
              </span>
            ))}
          </div>
        )}

        {form.project_url && (
          <div className="mt-3 flex items-center gap-1 text-xs font-medium text-crimson">
            <ExternalLink className="h-3 w-3" />
            View live site
          </div>
        )}
      </div>
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
