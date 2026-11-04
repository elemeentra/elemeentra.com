"use client";

import type { DeviceRow } from "@/lib/analytics";

const COLORS: Record<string, string> = {
  desktop: "var(--crimson)",
  mobile:  "#f59e0b",
  tablet:  "#10b981",
  unknown: "var(--border)",
};

export function DeviceDonut({ rows }: { rows: DeviceRow[] }) {
  const total = rows.reduce((s, r) => s + r.views, 0) || 1;
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No data yet.</p>;

  // Build SVG arcs
  const R = 40; const CX = 60; const CY = 60; const STROKE = 16;
  let offset = 0;
  const circ = 2 * Math.PI * R;
  const slices = rows.map((r) => {
    const pct = r.views / total;
    const dash = pct * circ;
    const s = { ...r, pct, dash, offset };
    offset += dash;
    return s;
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-24 w-24 shrink-0 -rotate-90">
        {slices.map((s) => (
          <circle key={s.device} cx={CX} cy={CY} r={R}
            fill="none"
            stroke={COLORS[s.device] ?? "var(--border)"}
            strokeWidth={STROKE}
            strokeDasharray={`${s.dash} ${circ - s.dash}`}
            strokeDashoffset={-s.offset}
          />
        ))}
      </svg>
      <ul className="space-y-1.5 text-sm">
        {slices.map((s) => (
          <li key={s.device} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COLORS[s.device] ?? "var(--border)" }} />
            <span className="capitalize text-foreground">{s.device}</span>
            <span className="ml-auto pl-4 font-mono text-xs text-muted">{Math.round(s.pct * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
