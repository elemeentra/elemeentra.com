"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not subscribe.");
      setState("done");
      setMsg("Thanks for subscribing!");
      setEmail("");
    } catch (err) {
      setState("error");
      setMsg(err instanceof Error ? err.message : "Could not subscribe.");
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm">
      <div className="flex gap-2">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" aria-label="Email address"
          className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson"
        />
        {/* honeypot */}
        <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website}
          onChange={(e) => setWebsite(e.target.value)} className="hidden" name="website" />
        <button type="submit" disabled={state === "loading"}
          className="flex items-center gap-1.5 rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
          {state === "loading" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Subscribe
        </button>
      </div>
      {msg && <p className={`mt-2 text-xs ${state === "done" ? "text-green-600" : "text-crimson"}`} role="status">{msg}</p>}
    </form>
  );
}
