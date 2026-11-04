"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

export function UnsubscribeButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  async function go() {
    setState("loading");
    try {
      const res = await fetch("/api/newsletter/unsubscribe", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }),
      });
      setState(res.ok ? "done" : "error");
    } catch { setState("error"); }
  }

  if (state === "done") return <p className="mt-6 text-sm font-medium text-green-600" role="status">You have been unsubscribed.</p>;
  return (
    <>
      <button onClick={go} disabled={state === "loading"}
        className="mt-6 inline-flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
        {state === "loading" && <Loader2 className="h-4 w-4 animate-spin" />} Unsubscribe me
      </button>
      {state === "error" && <p className="mt-3 text-sm text-crimson" role="alert">Something went wrong. Please try again.</p>}
    </>
  );
}
