"use client";

import { useCallback, useState } from "react";
import { Star, Loader2, CheckCircle2 } from "lucide-react";
import { HCaptcha } from "./HCaptcha";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-crimson";

export function ReviewForm() {
  const [f, setF] = useState({ name: "", email: "", rating: 0, review_title: "", review_text: "", website: "" });
  const [captcha, setCaptcha] = useState("");
  const [reset, setReset] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const onToken = useCallback((t: string) => setCaptcha(t), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading"); setError("");
    try {
      const res = await fetch("/api/reviews/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, captcha }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not submit your review.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your review.");
      setState("idle"); setReset((n) => n + 1);
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <h3 className="mt-3 text-lg font-bold text-foreground">Thank you!</h3>
        <p className="mt-1 text-sm text-muted">Your review will appear once it has been approved.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <h3 className="text-lg font-bold text-foreground">Leave a review</h3>
      <div role="radiogroup" aria-label="Rating" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} role="radio" aria-checked={f.rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => setF((p) => ({ ...p, rating: n }))}>
            <Star className={`h-7 w-7 ${n <= f.rating ? "fill-crimson text-crimson" : "text-border"}`} />
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <input required minLength={2} maxLength={150} placeholder="Your name *" aria-label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} />
        <input required type="email" maxLength={150} placeholder="Email * (not published)" aria-label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} />
      </div>
      <input maxLength={255} placeholder="Review title" aria-label="Review title" value={f.review_title} onChange={(e) => setF({ ...f, review_title: e.target.value })} className={input} />
      <textarea required minLength={10} maxLength={3000} rows={5} placeholder="Your experience *" aria-label="Review" value={f.review_text} onChange={(e) => setF({ ...f, review_text: e.target.value })} className={input} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <HCaptcha onToken={onToken} resetKey={reset} />
      {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
      <button type="submit" disabled={state === "loading" || f.rating === 0}
        className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />} Submit Review
      </button>
    </form>
  );
}
