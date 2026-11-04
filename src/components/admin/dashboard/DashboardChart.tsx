"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getJson, peek } from "@/lib/admin-cache";

export interface SeriesPoint {
  label: string;
  views: number;
}
type Range = "30d" | "90d" | "1y";

const PERIODS: { key: Range; label: string }[] = [
  { key: "30d", label: "Last 30 Days" },
  { key: "90d", label: "3 Months" },
  { key: "1y", label: "1 Year" },
];

const H = 220;
const LEFT = 45;
const RIGHT = 20;
const TOP = 20;
const BOTTOM = 195;

function niceMax(v: number): number {
  if (v <= 4) return 4;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * pow) return m * pow;
  return 10 * pow;
}
const fmt = (n: number) => (n >= 1000 ? `${+(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k` : String(n));

export function DashboardChart({ initial }: { initial: SeriesPoint[] }) {
  const [range, setRange] = useState<Range>("30d");
  const [series, setSeries] = useState<SeriesPoint[]>(initial);
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(850);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  // Draw at the real pixel width so dots/text never stretch.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(280, Math.round(el.clientWidth))));
    ro.observe(el);
    setWidth(Math.max(280, Math.round(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  async function pick(next: Range) {
    if (next === range) return;
    setRange(next);
    setHover(null);
    const url = `/api/admin/dashboard/series?range=${next}`;
    const hit = peek(url);
    if (hit) setSeries(hit.series);
    else setBusy(true);
    try {
      const res = await getJson(url);
      if (res.ok) setSeries(res.data.series);
    } finally {
      setBusy(false);
    }
  }

  const geo = useMemo(() => {
    const max = niceMax(Math.max(0, ...series.map((p) => p.views)));
    const plotW = width - LEFT - RIGHT;
    const n = series.length;
    const x = (i: number) => LEFT + (n <= 1 ? 0 : (plotW * i) / (n - 1));
    const y = (v: number) => BOTTOM - ((BOTTOM - TOP) * v) / max;
    const pts = series.map((p, i) => [x(i), y(p.views)] as const);
    const line = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)} ${py.toFixed(1)}`).join(" ");
    const area = pts.length ? `${line} L${pts[pts.length - 1][0].toFixed(1)} ${BOTTOM} L${pts[0][0].toFixed(1)} ${BOTTOM}Z` : "";
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({ v: Math.round(max * f), y: y(max * f) }));
    const step = Math.max(1, Math.round((n - 1) / 9));
    const xl = series.map((p, i) => ({ p, i })).filter(({ i }) => i % step === 0 || i === n - 1);
    return { max, x, pts, line, area, ticks, xl, plotW, n };
  }, [series, width]);

  const total = series.reduce((s, p) => s + p.views, 0);
  const shown = hover !== null ? series[hover] : null;

  return (
    <>
      <div className="dash-panel-head">
        <div className="dash-panel-title">
          <span className="dash-mini-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10m6 10V4m6 16v-7m6 7V7" /></svg>
          </span>
          Website Performance
        </div>
        <div className="dash-periods">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" className={`dash-period${range === p.key ? " active" : ""}`} onClick={() => pick(p.key)}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="dash-chart-wrap" ref={wrapRef} style={{ opacity: busy ? 0.55 : 1, transition: "opacity .15s" }}>
        <div className="dash-chart-tip">
          {shown ? `${shown.views.toLocaleString()} Views · ${shown.label}` : `${total.toLocaleString()} Views`}
        </div>
        <svg
          className="dash-chart"
          viewBox={`0 0 ${width} ${H}`}
          role="img"
          aria-label="Website page views trend chart"
          onMouseLeave={() => setHover(null)}
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const px = ((e.clientX - rect.left) / rect.width) * width;
            const i = Math.round(((px - LEFT) / geo.plotW) * (geo.n - 1));
            setHover(Math.min(geo.n - 1, Math.max(0, i)));
          }}
        >
          <defs>
            <linearGradient id="dashAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e64a64" stopOpacity=".28" />
              <stop offset="100%" stopColor="#e64a64" stopOpacity=".025" />
            </linearGradient>
          </defs>
          {geo.ticks.map((t) => (
            <g key={t.y}>
              <line className="gridline" x1={LEFT} y1={t.y} x2={width - RIGHT} y2={t.y} />
              <text x={LEFT - 8} y={t.y + 4} textAnchor="end">{fmt(t.v)}</text>
            </g>
          ))}
          <g className="axis">
            <line x1={LEFT} y1={TOP - 2} x2={LEFT} y2={BOTTOM} />
            <line x1={LEFT} y1={BOTTOM} x2={width - RIGHT} y2={BOTTOM} />
          </g>
          {geo.area && <path d={geo.area} fill="url(#dashAreaFill)" />}
          {geo.line && <path className="line" d={geo.line} />}
          {geo.n <= 16 && geo.pts.map(([px, py], i) => <circle key={i} className="dot" cx={px} cy={py} r={4.5} />)}
          {hover !== null && geo.pts[hover] && (
            <>
              <line x1={geo.pts[hover][0]} x2={geo.pts[hover][0]} y1={TOP} y2={BOTTOM} stroke="#e9b9c1" strokeDasharray="3 3" />
              <circle className="dot" cx={geo.pts[hover][0]} cy={geo.pts[hover][1]} r={5.5} />
            </>
          )}
          {geo.xl.map(({ p, i }) => (
            <text key={i} x={geo.x(i)} y={H - 4} textAnchor={i === 0 ? "start" : i === geo.n - 1 ? "end" : "middle"}>
              {p.label}
            </text>
          ))}
        </svg>
      </div>
    </>
  );
}
