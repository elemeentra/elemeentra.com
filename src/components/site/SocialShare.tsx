"use client";

import { useState } from "react";
import { Link2, Check } from "lucide-react";

/** Share links (X, Facebook, LinkedIn, WhatsApp) + copy-link. Uses the current page URL. */
export function SocialShare({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const url = () => (typeof window !== "undefined" ? window.location.href : "");
  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=600,height=500");
  const t = encodeURIComponent(title);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked */ }
  }

  const btn = "rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:border-crimson hover:text-crimson";
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Share this post">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">Share</span>
      <button type="button" className={btn} onClick={() => open(`https://twitter.com/intent/tweet?text=${t}&url=${encodeURIComponent(url())}`)}>X</button>
      <button type="button" className={btn} onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`)}>Facebook</button>
      <button type="button" className={btn} onClick={() => open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url())}`)}>LinkedIn</button>
      <button type="button" className={btn} onClick={() => open(`https://wa.me/?text=${t}%20${encodeURIComponent(url())}`)}>WhatsApp</button>
      <button type="button" className={`${btn} flex items-center gap-1`} onClick={copy}>
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Link2 className="h-3.5 w-3.5" />} {copied ? "Copied" : "Copy link"}
      </button>
    </div>
  );
}
