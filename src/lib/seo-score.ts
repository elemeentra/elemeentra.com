/**
 * SEO Scoring Engine — RankMath-style live checklist.
 * Pure functions, safe on client (live typing) and server (cached score).
 */

export interface SeoCheckItem {
  id: string;
  label: string;
  passed: boolean;
}

export interface SeoScoreResult {
  score: number; // 0-100
  checks: SeoCheckItem[];
}

export interface SeoScoreInput {
  title: string;
  seoTitle: string; // meta_title override, falls back to title
  slug: string;
  metaDescription: string;
  content: string; // HTML
  focusKeyword: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(plainText: string): number {
  if (!plainText) return 0;
  return plainText.split(/\s+/).filter(Boolean).length;
}

function containsKeyword(haystack: string, keyword: string): boolean {
  if (!keyword.trim()) return false;
  return haystack.toLowerCase().includes(keyword.trim().toLowerCase());
}

function firstParagraphWords(plainText: string, wordLimit = 120): string {
  return plainText.split(/\s+/).slice(0, wordLimit).join(" ");
}

function keywordInHeading(html: string, keyword: string): boolean {
  if (!keyword.trim()) return false;
  const headingMatches = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gis) || [];
  return headingMatches.some((h) => containsKeyword(stripHtml(h), keyword));
}

function hasAnyLink(html: string): boolean {
  return /<a\s+[^>]*href=/i.test(html);
}

export function calculateSeoScore(input: SeoScoreInput): SeoScoreResult {
  const plainContent = stripHtml(input.content || "");
  const wordCount = countWords(plainContent);
  const keyword = input.focusKeyword || "";
  const effectiveTitle = input.seoTitle || input.title || "";

  const checks: SeoCheckItem[] = [
    { id: "focus_keyword_set", label: "Focus keyword set", passed: keyword.trim().length > 0 },
    { id: "keyword_in_seo_title", label: "Keyword in SEO title", passed: containsKeyword(effectiveTitle, keyword) },
    {
      id: "keyword_in_meta_description",
      label: "Keyword in meta description",
      passed: containsKeyword(input.metaDescription, keyword),
    },
    {
      id: "keyword_in_url_slug",
      label: "Keyword in URL slug",
      passed: containsKeyword((input.slug || "").replace(/-/g, " "), keyword),
    },
    {
      id: "keyword_in_first_paragraph",
      label: "Keyword in first paragraph",
      passed: containsKeyword(firstParagraphWords(plainContent), keyword),
    },
    { id: "keyword_in_heading", label: "Keyword in a heading", passed: keywordInHeading(input.content, keyword) },
    {
      id: "seo_title_length",
      label: "SEO title length (30-60 chars)",
      passed: effectiveTitle.length >= 30 && effectiveTitle.length <= 60,
    },
    {
      id: "meta_description_length",
      label: "Meta description length (120-160 chars)",
      passed: input.metaDescription.length >= 120 && input.metaDescription.length <= 160,
    },
    { id: "content_length", label: "Content length (300+ words)", passed: wordCount >= 300 },
    { id: "has_link", label: "Contains at least one link", passed: hasAnyLink(input.content) },
  ];

  const perCheck = 100 / checks.length;
  const score = Math.round(checks.reduce((sum, c) => sum + (c.passed ? perCheck : 0), 0));

  return { score, checks };
}

export function getSeoScoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 50) return "text-amber-600";
  return "text-crimson";
}

export function getSeoScoreBgColor(score: number): string {
  if (score >= 80) return "bg-green-100/40";
  if (score >= 50) return "bg-amber-100/40";
  return "bg-crimson-light";
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
