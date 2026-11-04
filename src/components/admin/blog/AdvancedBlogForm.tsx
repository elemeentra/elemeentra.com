"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, ImagePlus, Loader2, Save, Send } from "lucide-react";
import dynamic from "next/dynamic";
import { SeoPanel } from "./SeoPanel";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { TagsInput } from "./TagsInput";
import { FaqSchemaBuilder, type FaqItem } from "./FaqSchemaBuilder";
import { AuthorSelector } from "./AuthorSelector";
import { useAdminBase } from "@/lib/use-admin-base";
import { slugify } from "@/lib/seo-score";

// Heavy editor + media picker load on demand instead of with the page shell.
const BlogRichTextEditor = dynamic(() => import("./BlogRichTextEditor").then((m) => m.BlogRichTextEditor), {
  ssr: false,
  loading: () => <div className="h-96 animate-pulse rounded-2xl bg-surface" aria-hidden />,
});
const MediaPickerModal = dynamic(() => import("@/components/admin/MediaPickerModal").then((m) => m.MediaPickerModal), { ssr: false });

interface CategoryOption {
  id: number;
  name: string;
}

export interface AdvancedBlogFormData {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  meta_title: string;
  meta_description: string;
  canonical_url: string;
  robots_index: boolean;
  robots_follow: boolean;
  og_image: string;
  og_title: string;
  og_description: string;
  featured_image: string;
  category_ids: number[];
  tags: number[];
  status: "draft" | "pending" | "published" | "scheduled";
  published_at: string;
  author_id: number | null;
  focus_keyword: string;
  faq_schema: FaqItem[];
}

interface AdvancedBlogFormProps {
  mode: "create" | "edit";
  postId?: number;
  initialData?: Partial<AdvancedBlogFormData>;
}

/** DB dates are UTC ("YYYY-MM-DD HH:MM:SS"); <input type="datetime-local"> wants local "YYYY-MM-DDTHH:mm". */
function utcToLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) return value; // already a local input value
  const d = new Date(value.replace(" ", "T").slice(0, 19) + "Z");
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 12-hour date/time picker (date + HH : MM + AM/PM) that reads/writes a local "YYYY-MM-DDTHH:mm" string. */
function SchedulePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [datePart = "", timePart = ""] = value.split("T");
  const [h24Str = "", minStr = ""] = timePart.split(":");
  const hasTime = h24Str !== "";
  const h24 = hasTime ? parseInt(h24Str, 10) : 0;
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const hour12 = hasTime ? (h24 % 12 === 0 ? 12 : h24 % 12) : 12;
  const minute = hasTime ? parseInt(minStr, 10) || 0 : 0;
  const pad = (n: number) => String(n).padStart(2, "0");

  function emit(date: string, h12: number, min: number, per: "AM" | "PM") {
    if (!date) { onChange(""); return; }
    const h = (h12 % 12) + (per === "PM" ? 12 : 0);
    onChange(`${date}T${pad(h)}:${pad(min)}`);
  }
  const box = "rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20";

  return (
    <div className="space-y-2">
      <input type="date" value={datePart} onChange={(e) => emit(e.target.value, hour12, minute, period)} className={`w-full ${box}`} aria-label="Publish date" />
      <div className="flex items-center gap-2">
        <input type="number" min={1} max={12} value={hour12} aria-label="Hour"
          onChange={(e) => emit(datePart, Math.min(12, Math.max(1, parseInt(e.target.value, 10) || 12)), minute, period)}
          className={`w-16 text-center ${box}`} />
        <span className="font-bold text-muted">:</span>
        <input type="number" min={0} max={59} value={pad(minute)} aria-label="Minute"
          onChange={(e) => emit(datePart, hour12, Math.min(59, Math.max(0, parseInt(e.target.value, 10) || 0)), period)}
          className={`w-16 text-center ${box}`} />
        <div className="ml-1 flex overflow-hidden rounded-md border border-border">
          {(["AM", "PM"] as const).map((per) => (
            <button key={per} type="button" onClick={() => emit(datePart, hour12, minute, per)}
              className={`px-3 py-2 text-xs font-bold transition ${period === per ? "bg-crimson text-white" : "bg-background text-muted hover:text-foreground"}`}>
              {per}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdvancedBlogForm({ mode, postId, initialData }: AdvancedBlogFormProps) {
  const router = useRouter();
  const adminBase = useAdminBase();
  const [form, setForm] = useState<AdvancedBlogFormData>({
    title: initialData?.title ?? "",
    slug: initialData?.slug ?? "",
    excerpt: initialData?.excerpt ?? "",
    content: initialData?.content ?? "",
    meta_title: initialData?.meta_title ?? "",
    meta_description: initialData?.meta_description ?? "",
    canonical_url: initialData?.canonical_url ?? "",
    robots_index: initialData?.robots_index ?? true,
    robots_follow: initialData?.robots_follow ?? true,
    og_image: initialData?.og_image ?? "",
    og_title: initialData?.og_title ?? "",
    og_description: initialData?.og_description ?? "",
    featured_image: typeof initialData?.featured_image === "string" ? initialData.featured_image : "",
    category_ids: initialData?.category_ids ?? [],
    tags: initialData?.tags ?? [],
    status: initialData?.status ?? "draft",
    published_at: utcToLocalInput(initialData?.published_at),
    author_id: initialData?.author_id ?? null,
    focus_keyword: initialData?.focus_keyword ?? "",
    faq_schema: initialData?.faq_schema ?? [],
  });

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [savingAction, setSavingAction] = useState<"save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showFeaturedPicker, setShowFeaturedPicker] = useState(false);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await fetch("/api/admin/categories");
        const data = await res.json();
        setCategories(data.categories || []);
      } finally {
        setCategoriesLoading(false);
      }
    };
    loadCategories();
  }, []);

  // Auto-derive slug from title until the user manually edits it
  useEffect(() => {
    if (!slugTouched) {
      setForm((prev) => ({ ...prev, slug: slugify(prev.title) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.title, slugTouched]);

  function update<K extends keyof AdvancedBlogFormData>(key: K, value: AdvancedBlogFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleCreateCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    try {
      const res = await fetch("/api/admin/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        setCategories((prev) => (prev.some((c) => c.id === data.category.id) ? prev : [...prev, data.category]));
        update("category_ids", [...form.category_ids, data.category.id]);
        setNewCategoryName("");
      }
    } finally {
      setCreatingCategory(false);
    }
  }

  // One save path that respects the Status dropdown. (Before, the top button always
  // forced "draft" — un-publishing live posts — and the sidebar button always forced
  // "published", so Pending/Scheduled could never be saved.)
  async function handleSave() {
    setError(null);

    if (form.status === "scheduled" && !form.published_at) {
      setError("Please set a publish date for scheduling.");
      return;
    }
    if (form.status === "scheduled" && new Date(form.published_at).getTime() <= Date.now()) {
      setError("Pick a date in the future to schedule this post.");
      return;
    }

    setSaving(true);
    setSavingAction("save");

    try {
      const payload = {
        ...form,
        // local input value -> real instant; empty stays empty (server stamps "now" when publishing)
        published_at: form.published_at ? new Date(form.published_at).toISOString() : "",
      };

      const url = mode === "create" ? "/api/admin/blog" : `/api/admin/blog/${postId}`;
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
        setSavingAction(null);
        return;
      }

      // Stay in the editor (WordPress-style): a new post moves to its edit URL,
      // an existing one just shows "Saved at …".
      setSaving(false);
      setSavingAction(null);
      setLastSaved(new Date().toLocaleTimeString());
      if (mode === "create") {
        router.replace(`${adminBase}/blog/${data.id}/edit`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
      setSavingAction(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="rounded-2xl border border-border bg-card px-6 py-4">
        <Link href={`${adminBase}/blog`} className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted transition hover:text-crimson">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Posts
        </Link>
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-foreground">
            {mode === "create" ? "New Post" : "Edit Post"}
          </h1>
          <div className="flex items-center gap-3">
          {lastSaved && <span className="text-xs text-muted">Saved at {lastSaved}</span>}
          {mode === "edit" && (
            <a
              href={`/blog/preview/${postId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              <Eye className="h-4 w-4" /> Preview
            </a>
          )}
          <button
            onClick={() => handleSave()}
            disabled={saving}
            className="flex items-center gap-2 rounded-md bg-crimson px-4 py-2 text-sm font-medium text-white transition hover:bg-crimson-hover disabled:opacity-60"
          >
            {savingAction === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
            {savingAction !== "save" && <Save className="h-4 w-4" />}
            Save
          </button>
          </div>
        </div>
        {error && (
          <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 font-medium">
            {error}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Left: editor + SEO. Normal page flow (no inner scroll pane), so the editor toolbar can stick under the top bar. */}
        <div className="min-w-0 space-y-5">
        <div className="rounded-2xl border border-border bg-card">
          {/* Post Title */}
          <div className="border-b border-border px-8 py-6 space-y-2">
            <input
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Post title…"
              className="w-full text-3xl font-bold text-foreground bg-transparent border-0 outline-none placeholder-muted-foreground/40 p-0"
            />
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <span>elemeentra.com/blog/</span>
              <input
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  update("slug", slugify(e.target.value));
                }}
                className="border-b border-transparent bg-transparent text-crimson outline-none focus:border-crimson"
              />
            </div>
          </div>

          {/* Excerpt */}
          <div className="border-b border-border px-8 py-4">
            <textarea
              value={form.excerpt}
              onChange={(e) => update("excerpt", e.target.value)}
              placeholder="Short excerpt (shown in listing cards)…"
              rows={2}
              maxLength={300}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
            />
          </div>

          {/* Editor Content */}
          <div className="px-8 py-6">
            <BlogRichTextEditor
              value={form.content}
              onChange={(html) => update("content", html)}
              minHeight={600}
            />
          </div>
        </div>

        {/* SEO — below the editor, full width */}
        <div className="space-y-5">
          {/* SEO */}
          <SeoPanel
            title={form.title}
            slug={form.slug}
            content={form.content}
            focusKeyword={form.focus_keyword}
            onFocusKeywordChange={(keyword) => update("focus_keyword", keyword)}
            seoTitle={form.meta_title}
            onSeoTitleChange={(v) => update("meta_title", v)}
            metaDescription={form.meta_description}
            onMetaDescriptionChange={(v) => update("meta_description", v)}
            canonicalUrl={form.canonical_url}
            onCanonicalUrlChange={(v) => update("canonical_url", v)}
            robotsIndex={form.robots_index}
            onRobotsIndexChange={(v) => update("robots_index", v)}
            robotsFollow={form.robots_follow}
            onRobotsFollowChange={(v) => update("robots_follow", v)}
            ogImage={form.og_image}
            onOgImageChange={(v) => update("og_image", v)}
            ogTitle={form.og_title}
            ogDescription={form.og_description}
            onOgTitleChange={(v) => update("og_title", v)}
            onOgDescriptionChange={(v) => update("og_description", v)}
          />

          {/* FAQ */}
          <FaqSchemaBuilder value={form.faq_schema} onChange={(items) => update("faq_schema", items)} />
        </div>
        </div>

        {/* Right: sidebar — stays in view while you scroll long posts */}
        <aside className="xl:sticky xl:top-[calc(var(--topbar-h,88px)+16px)] xl:max-h-[calc(100vh-var(--topbar-h,88px)-32px)] xl:overflow-y-auto xl:pr-1">
          <div className="space-y-5">
            {/* PUBLISH */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Publish</h3>
              <div className="bg-card border border-border rounded-md p-4 space-y-3">
                <div>
                  <label className="mb-2 block text-xs font-medium text-foreground">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) =>
                      update("status", e.target.value as "draft" | "pending" | "published" | "scheduled")
                    }
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
                  >
                    <option value="draft">Draft</option>
                    <option value="pending">Pending Review</option>
                    <option value="published">Published</option>
                    <option value="scheduled">Scheduled</option>
                  </select>
                </div>
                {form.status === "scheduled" && (
                  <div>
                    <label className="mb-2 block text-xs font-medium text-foreground">Publish Date &amp; Time</label>
                    <SchedulePicker value={form.published_at} onChange={(v) => update("published_at", v)} />
                  </div>
                )}
                <button
                  onClick={() => handleSave()}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-crimson px-3 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60"
                >
                  {savingAction === "save" && <Loader2 className="h-4 w-4 animate-spin" />}
                  {savingAction !== "save" && <Send className="h-4 w-4" />}
                  {{ draft: "Save Draft", pending: "Submit for Review", published: mode === "edit" ? "Update Post" : "Publish", scheduled: "Schedule Post" }[form.status]}
                </button>
              </div>
            </div>

            {/* FEATURED IMAGE */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Featured Image</h3>
              <div className="bg-card border border-border rounded-md p-4">
                <ImageUploader
                  value={form.featured_image}
                  onChange={(url) => update("featured_image", url ?? "")}
                  aspect={16 / 9}
                  cropTitle="Crop featured image"
                  wide
                />
                <button
                  type="button"
                  onClick={() => setShowFeaturedPicker(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border py-2 text-xs font-semibold text-foreground transition hover:bg-surface"
                >
                  <ImagePlus className="h-3.5 w-3.5" /> Choose from Media Library
                </button>
                <MediaPickerModal
                  open={showFeaturedPicker}
                  onClose={() => setShowFeaturedPicker(false)}
                  onSelect={(url) => { update("featured_image", url); setShowFeaturedPicker(false); }}
                />
              </div>
            </div>

            {/* CATEGORIES */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Categories</h3>
              <div className="bg-card border border-border rounded-md p-4">
                {categoriesLoading ? (
                  <p className="text-xs text-muted">Loading…</p>
                ) : categories.length === 0 ? (
                  <p className="text-xs text-muted">No categories yet.</p>
                ) : (
                  <div className="max-h-40 space-y-1.5 overflow-y-auto">
                    {categories.map((cat) => (
                      <label key={cat.id} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                        <input
                          type="checkbox"
                          checked={form.category_ids.includes(cat.id)}
                          onChange={() =>
                            update(
                              "category_ids",
                              form.category_ids.includes(cat.id)
                                ? form.category_ids.filter((id) => id !== cat.id)
                                : [...form.category_ids, cat.id]
                            )
                          }
                          className="h-3.5 w-3.5 rounded border-border text-crimson focus:ring-crimson"
                        />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreateCategory();
                      }
                    }}
                    placeholder="New category"
                    className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={creatingCategory || !newCategoryName.trim()}
                    className="rounded-md bg-surface px-3 text-sm text-foreground transition hover:bg-border disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* TAGS */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Tags</h3>
              <div className="bg-card border border-border rounded-md p-4">
                <TagsInput value={form.tags} onChange={(ids) => update("tags", ids)} />
              </div>
            </div>

            {/* AUTHOR */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Author</h3>
              <div className="bg-card border border-border rounded-md p-4">
                <AuthorSelector value={form.author_id} onChange={(id) => update("author_id", id)} />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
