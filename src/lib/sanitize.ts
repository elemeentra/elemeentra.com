import "server-only";
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "s", "u",
  "h2", "h3",
  "ul", "ol", "li",
  "blockquote",
  "a", "img",
];

/**
 * Sanitizes HTML produced by the RichTextEditor before it's stored. This is
 * a server-side backstop — even though the editor UI only produces this
 * subset of tags, a request could bypass the UI entirely (direct API call),
 * so the API layer must not trust client-supplied HTML at face value.
 */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "rel", "target", "src", "alt", "class"],
  });
}

/**
 * Converts plain text (from a simple <textarea>, not the rich text editor)
 * into safe paragraph HTML: blank lines separate paragraphs, single
 * newlines become <br>. Input is treated as untrusted plain text — all
 * HTML-significant characters are escaped before any tags are added, so
 * there's no injection risk even though the output is stored/rendered as
 * HTML.
 */
export function textToParagraphs(text: string | null | undefined): string {
  if (!text || !text.trim()) return "";

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  return text
    .trim()
    .split(/\n\s*\n/) // blank line = new paragraph
    .map((block) => `<p>${escapeHtml(block.trim()).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * Reverses `textToParagraphs` for populating a plain <textarea> when
 * editing — without this, the edit form would show raw `<p>`/`<br>` tags
 * instead of the plain text the admin originally typed.
 */
export function paragraphsToText(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/^<p>/i, "")
    .replace(/<\/p>$/i, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
