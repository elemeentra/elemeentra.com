"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";

const OPTIONS = [
  { label: "7d",  value: 7 },
  { label: "30d", value: 30 },
  { label: "90d", value: 90 },
];

export function RangeSelector({ current }: { current: number }) {
  const router   = useRouter();
  const pathname = usePathname();
  const params   = useSearchParams();

  function set(v: number) {
    const p = new URLSearchParams(params.toString());
    p.set("range", String(v));
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-sm">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          onClick={() => set(o.value)}
          className={`rounded-md px-3 py-1 font-medium transition ${
            current === o.value
              ? "bg-crimson text-white shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
