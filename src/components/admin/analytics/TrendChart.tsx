"use client";

import { useMemo } from "react";
import type { DailyViewRow } from "@/lib/analytics";

interface Props {
  data: DailyViewRow[];
  days: number;
}

/** Fills gaps with 0 so the chart always has `days` data points. */
function fillGaps(data: DailyViewRow[], days: number): DailyViewRow[] {
  const map = new Map(data.map((r) => [r.date, r.views]));
  const result: DailyViewRow[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, views: map.get(key) ?? 0 });
  }
  return result;
}

export function TrendChart({ data, days }: Props) {
  const filled = useMemo(() => fillGaps(data, days), [data, days]);
  const max = Math.max(...filled.map((r) => r.views), 1);
  const W = 600;
  const H = 120;
  const PAD = { top: 8, right: 4, bottom: 20, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const pts = filled.map((r, i) => {
    const x = PAD.left + (i / (filled.length - 1 || 1)) * innerW;
    const y = PAD.top + innerH - (r.views / max) * innerH;
    return `${x},${y}`;
  });

  const area = `M${pts[0]} L${pts.slice(1).join(" L")} L${PAD.left + innerW},${PAD.top + innerH} L${PAD.left},${PAD.top + innerH} Z`;
  const line = `M${pts[0]} L${pts.slice(1).join(" L")}`;

  // Y-axis labels
  const yLabels = [0, Math.round(max / 2), max];

  // X-axis: show only first, mid, last
  const xLabels = [0, Math.floor(filled.length / 2), filled.length - 1].map((i) => ({
    x: PAD.left + (i / (filled.length - 1 || 1)) * innerW,
    label: filled[i]?.date.slice(5) ?? "", // MM-DD
  }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 120 }}>
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--crimson)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--crimson)" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y grid lines */}
      {yLabels.map((v) => {
        const y = PAD.top + innerH - (v / max) * innerH;
        return (
          <g key={v}>
            <line x1={PAD.left} y1={y} x2={PAD.left + innerW} y2={y}
              stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3,3" />
            <text x={PAD.left - 4} y={y + 3} textAnchor="end"
              fontSize="8" fill="var(--muted)">{v}</text>
          </g>
        );
      })}

      {/* Area fill */}
      <path d={area} fill="url(#areaGrad)" />

      {/* Line */}
      <path d={line} fill="none" stroke="var(--crimson)" strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />

      {/* X-axis labels */}
      {xLabels.map(({ x, label }) => (
        <text key={label} x={x} y={H - 4} textAnchor="middle"
          fontSize="8" fill="var(--muted)">{label}</text>
      ))}
    </svg>
  );
}
