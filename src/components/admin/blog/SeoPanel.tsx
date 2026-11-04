"use client";

import { useMemo } from "react";
import { Check, X, ImagePlus } from "lucide-react";
import { calculateSeoScore, getSeoScoreColor, getSeoScoreBgColor } from "@/lib/seo-score";

interface SeoPanelProps {
  title: string;
  slug: string;
  content: string;
  focusKeyword: string;
  onFocusKeywordChange: (keyword: string) => void;
  seoTitle: string;
  onSeoTitleChange: (value: string) => void;
  metaDescription: string;
  onMetaDescriptionChange: (value: string) => void;
  canonicalUrl: string;
  onCanonicalUrlChange: (value: string) => void;
  robotsIndex: boolean;
  onRobotsIndexChange: (value: boolean) => void;
  robotsFollow: boolean;
  onRobotsFollowChange: (value: boolean) => void;
  ogImage: string;
  ogTitle: string;
  ogDescription: string;
  onOgTitleChange: (v: string) => void;
  onOgDescriptionChange: (v: string) => void;
  onOgImageChange: (value: string) => void;
}

export function SeoPanel({
  title,
  slug,
  content,
  focusKeyword,
  onFocusKeywordChange,
  seoTitle,
  onSeoTitleChange,
  metaDescription,
  onMetaDescriptionChange,
  canonicalUrl,
  onCanonicalUrlChange,
  robotsIndex,
  onRobotsIndexChange,
  robotsFollow,
  onRobotsFollowChange,
  ogImage,
  ogTitle,
  ogDescription,
  onOgTitleChange,
  onOgDescriptionChange,
  onOgImageChange,
}: SeoPanelProps) {
  const { score, checks } = useMemo(
    () => calculateSeoScore({ title, seoTitle, slug, metaDescription, content, focusKeyword }),
    [title, seoTitle, slug, metaDescription, content, focusKeyword]
  );

  const effectiveTitleLength = (seoTitle || title).length;

  return (
    <div>
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">SEO</h3>
      <div className="grid gap-x-8 gap-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm lg:grid-cols-2">
        <div className="space-y-4">
        {/* Score Card */}
        <div className={`flex items-center gap-3 rounded-md ${getSeoScoreBgColor(score)} p-3`}>
          <div className="relative h-10 w-10 flex-shrink-0">
            <svg className="h-10 w-10 -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="2" fill="none" className="text-border" />
              <circle
                cx="50"
                cy="50"
                r="45"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${2.827 * (score || 0)} 282.7`}
                className={`transition-all ${getSeoScoreColor(score)}`}
              />
            </svg>
            <div className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${getSeoScoreColor(score)}`}>
              {score}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted">SEO Score</p>
            <p className={`text-xs font-semibold ${getSeoScoreColor(score)}`}>
              {score >= 80 ? "Excellent" : score >= 50 ? "Good" : "Needs Work"}
            </p>
          </div>
        </div>

        {/* Focus Keyword */}
        <Field label="Focus Keyword">
          <input
            type="text"
            value={focusKeyword}
            onChange={(e) => onFocusKeywordChange(e.target.value)}
            placeholder="e.g. WordPress SEO"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
          />
        </Field>

        {/* SEO Title */}
        <Field label="SEO Title" counter={`${effectiveTitleLength}/60`}>
          <input
            type="text"
            value={seoTitle}
            onChange={(e) => onSeoTitleChange(e.target.value)}
            placeholder={title || "SEO title…"}
            maxLength={60}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
          />
        </Field>

        {/* Meta Description */}
        <Field label="Meta Description" counter={`${metaDescription.length}/160`}>
          <textarea
            value={metaDescription}
            onChange={(e) => onMetaDescriptionChange(e.target.value)}
            maxLength={160}
            rows={3}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20 resize-none"
          />
        </Field>

        {/* Canonical URL + robots */}
        <Field label="Canonical URL">
          <input
            type="text"
            value={canonicalUrl}
            onChange={(e) => onCanonicalUrlChange(e.target.value)}
            placeholder="https://elemeentra.com/blog/…"
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
          />
        </Field>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              checked={!robotsIndex}
              onChange={(e) => onRobotsIndexChange(!e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border text-crimson focus:ring-crimson"
            />
            noindex
          </label>
          <label className="flex items-center gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              checked={!robotsFollow}
              onChange={(e) => onRobotsFollowChange(!e.target.checked)}
              className="h-3.5 w-3.5 rounded border-border text-crimson focus:ring-crimson"
            />
            nofollow
          </label>
        </div>

        </div>
        <div className="space-y-4">
        {/* OG Image (social share image — schema uses an image, not text fields) */}
        <Field label="Social Share Image (OG Image)">
          <div className="flex items-center gap-2">
            {ogImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ogImage} alt="" className="h-10 w-10 rounded-md object-cover border border-border" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-md border border-dashed border-border text-muted">
                <ImagePlus className="h-4 w-4" />
              </div>
            )}
            <input
              type="text"
              value={ogImage}
              onChange={(e) => onOgImageChange(e.target.value)}
              placeholder="Image URL (or reuse Featured Image)"
              className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20 flex-1"
            />
          </div>
        </Field>

        <Field label="Social Share Title (OG Title)">
          <input
            type="text"
            value={ogTitle}
            onChange={(e) => onOgTitleChange(e.target.value)}
            placeholder="Defaults to the SEO title"
            maxLength={255}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
          />
        </Field>
        <Field label="Social Share Description (OG Description)">
          <textarea
            value={ogDescription}
            onChange={(e) => onOgDescriptionChange(e.target.value)}
            placeholder="Defaults to the meta description"
            rows={2}
            maxLength={500}
            className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
          />
        </Field>

        {/* Checklist */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-foreground">Checklist</p>
          <ul className="space-y-1">
            {checks.map((check) => (
              <li key={check.id} className="flex items-center gap-2 text-xs">
                {check.passed ? (
                  <Check className="h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                ) : (
                  <X className="h-3.5 w-3.5 flex-shrink-0 text-crimson/70" />
                )}
                <span className={check.passed ? "text-foreground" : "text-muted"}>{check.label}</span>
              </li>
            ))}
          </ul>
        </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, counter, children }: { label: string; counter?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-xs font-medium text-foreground">{label}</label>
        {counter && <span className="text-[10px] text-muted">{counter}</span>}
      </div>
      {children}
    </div>
  );
}
