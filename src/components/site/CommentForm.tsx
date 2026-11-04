"use client";

import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { HCaptcha } from "./HCaptcha";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-crimson";

export function CommentForm({ slug }: { slug: string }) {
  const [f, setF] = useState({ name: "", email: "", comment_text: "", website: "" });
  const [captcha, setCaptcha] = useState("");
  const [reset, setReset] = useState(0);
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const onToken = useCallback((t: string) => setCaptcha(t), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading"); setError("");
    try {
      const res = await fetch("/api/comments/submit", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, slug, captcha }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not post your comment.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post your comment.");
      setState("idle"); setReset((n) => n + 1);
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-semibold text-foreground">{f.name}</p>
        <p className="mt-1 whitespace-pre-line text-sm text-muted">{f.comment_text}</p>
        <p className="mt-3 inline-block rounded-full bg-yellow-500/15 px-2.5 py-1 text-xs font-medium text-yellow-700">
          Awaiting moderation — it will appear once approved.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input required minLength={2} maxLength={150} placeholder="Name *" aria-label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} />
        <input required type="email" maxLength={150} placeholder="Email * (not published)" aria-label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} />
      </div>
      <textarea required minLength={3} maxLength={2000} rows={4} placeholder="Write a comment…" aria-label="Comment" value={f.comment_text} onChange={(e) => setF({ ...f, comment_text: e.target.value })} className={input} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      <HCaptcha onToken={onToken} resetKey={reset} />
      {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
      <button type="submit" disabled={state === "loading"}
        className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />} Post Comment
      </button>
    </form>
  );
}
