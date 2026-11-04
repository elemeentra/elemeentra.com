"use client";

import { useCallback, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { HCaptcha } from "./HCaptcha";

const input = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-crimson";

export function ContactForm({ services }: { services: string[] }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", service_interested: "", message: "", website: "" });
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState("");
  const [captcha, setCaptcha] = useState("");
  const [reset, setReset] = useState(0);
  const onToken = useCallback((t: string) => setCaptcha(t), []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setError("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...f, captcha }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not send your message.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
      setState("idle");
      setReset((n) => n + 1);
    }
  }

  if (state === "done") {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-green-600" />
        <h3 className="mt-3 text-lg font-bold text-foreground">Message sent!</h3>
        <p className="mt-1 text-sm text-muted">Thanks for reaching out — we&apos;ll reply within one business day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className="mb-1 block text-xs font-medium text-muted" htmlFor="c-name">Name *</label>
          <input id="c-name" required minLength={2} maxLength={150} value={f.name} onChange={set("name")} className={input} /></div>
        <div><label className="mb-1 block text-xs font-medium text-muted" htmlFor="c-email">Email *</label>
          <input id="c-email" type="email" required maxLength={150} value={f.email} onChange={set("email")} className={input} /></div>
        <div><label className="mb-1 block text-xs font-medium text-muted" htmlFor="c-phone">Phone</label>
          <input id="c-phone" maxLength={50} value={f.phone} onChange={set("phone")} className={input} /></div>
        <div><label className="mb-1 block text-xs font-medium text-muted" htmlFor="c-service">Service</label>
          <select id="c-service" value={f.service_interested} onChange={set("service_interested")} className={input}>
            <option value="">Select a service…</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="Other">Other</option>
          </select></div>
      </div>
      <div><label className="mb-1 block text-xs font-medium text-muted" htmlFor="c-msg">Message *</label>
        <textarea id="c-msg" required minLength={10} maxLength={5000} rows={6} value={f.message} onChange={set("message")} className={input} /></div>
      {/* honeypot */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={f.website} onChange={set("website")} />
      <HCaptcha onToken={onToken} resetKey={reset} />
      {error && <p className="text-sm text-crimson" role="alert">{error}</p>}
      <button type="submit" disabled={state === "loading"}
        className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />} Send Message
      </button>
    </form>
  );
}
