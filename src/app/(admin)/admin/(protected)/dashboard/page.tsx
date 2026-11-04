import Link from "next/link";
import fs from "node:fs/promises";
import path from "node:path";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { getEnv } from "@/lib/env";
import { query } from "@/lib/db";
import { getBrand } from "@/lib/branding";
import {
  growth, loadDashboardCounts, loadRecentMessages, loadSparklines, loadViewsSeries,
  type SparkKey,
} from "@/lib/dashboard-data";
import { DashboardChart } from "@/components/admin/dashboard/DashboardChart";
import { Greeting } from "@/components/admin/dashboard/Greeting";

export const dynamic = "force-dynamic";

/* ---------- small helpers ---------- */

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr.replace(" ", "T") + (dateStr.includes("T") ? "" : "Z")).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (!Number.isFinite(mins) || mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p.length > 1 ? p[p.length - 1][0] : "")).toUpperCase();
}

function uptimeLabel(): string {
  const s = Math.floor(process.uptime());
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function sparkPath(values: number[]): string | null {
  if (values.every((v) => v === 0)) return null;
  const max = Math.max(...values);
  const pts = values.map((v, i) => [1 + (68 * i) / (values.length - 1), 27 - (24 * v) / max] as const);
  let d = `M${pts[0][0]} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    d += ` Q${px.toFixed(1)} ${py.toFixed(1)} ${((px + cx) / 2).toFixed(1)} ${((py + cy) / 2).toFixed(1)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} T${lx.toFixed(1)} ${ly.toFixed(1)}`;
}

async function checkSystem() {
  const [db, uploads] = await Promise.all([
    (async () => {
      const t = Date.now();
      try {
        await query("SELECT 1");
        return { ok: true, ms: Date.now() - t };
      } catch {
        return { ok: false, ms: null as number | null };
      }
    })(),
    fs
      .access(path.join(process.cwd(), "public", "uploads"), fs.constants.W_OK)
      .then(() => true)
      .catch(() => fs.access(path.join(process.cwd(), "public"), fs.constants.W_OK).then(() => true).catch(() => false)),
  ]);
  return { db, uploads };
}

/* ---------- icons (same paths as the design) ---------- */

const Svg = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

const ICONS = {
  eye: <Svg><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Svg>,
  post: <Svg><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m3 6 9 7 9-7" /></Svg>,
  portfolio: <Svg><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V4h8v3M3 12h18" /></Svg>,
  users: <Svg><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m7-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm9-1a4 4 0 0 0 0-7m4 18v-2a4 4 0 0 0-3-3.9" /></Svg>,
  comment: <Svg><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-4-.9L3 21l1.5-4.5A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z" /></Svg>,
  bolt: <Svg><path d="m13 2-9 12h7l-1 8 10-13h-7z" /></Svg>,
  edit: <Svg><path d="m4 16 11-11 4 4L8 20l-5 1zM13 7l4 4" /></Svg>,
  grid: <Svg><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></Svg>,
  person: <Svg><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>,
  image: <Svg><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></Svg>,
  send: <Svg><path d="m3 11 18-8-6.5 18-3.5-7-8-3Z" /><path d="m11 14 4-4" /></Svg>,
  shield: <Svg><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></Svg>,
  server: <Svg><rect x="3" y="3" width="18" height="7" rx="2" /><rect x="3" y="14" width="18" height="7" rx="2" /><path d="M7 6.5h.01M7 17.5h.01M11 6.5h7M11 17.5h7" /></Svg>,
  upload: <Svg><path d="M12 16V4m-4 4 4-4 4 4" /><path d="M20 16.5a4 4 0 0 0-2.5-7.4A6 6 0 0 0 6 10a4 4 0 0 0-1 7.9M8 20h8" /></Svg>,
  clock: <Svg><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>,
  external: <Svg><path d="M14 4h6v6m-11 3L20 4M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></Svg>,
};

/* ---------- page ---------- */

export default async function DashboardPage() {
  const session = await getFreshSession();
  const env = getEnv();
  const base = `/${env.ADMIN_PATH}`;

  const isSuperAdmin = session?.roleName === SUPER_ADMIN_ROLE;
  const can = (mod: Parameters<typeof hasPermission>[2], act: Parameters<typeof hasPermission>[3]) =>
    session ? hasPermission(session.permissions, isSuperAdmin, mod, act) : false;

  // Everything is fetched in parallel; counts are ONE query (see lib/dashboard-data.ts).
  const [c, series, spark, messages, system, brand] = await Promise.all([
    loadDashboardCounts(),
    loadViewsSeries("30d"),
    loadSparklines(),
    can("contacts", "view") ? loadRecentMessages(4) : Promise.resolve([]),
    checkSystem(),
    getBrand(),
  ]);

  const g = growth(c.viewsThisMonth, c.viewsLastMonth);
  const firstName = (session?.name ?? "Admin").trim();

  type Stat = { key: SparkKey; label: string; value: number; icon: React.ReactNode; href: string; foot: React.ReactNode; show: boolean };
  const stats: Stat[] = [
    {
      key: "views", label: "Page Views", value: c.pageViews, icon: ICONS.eye, href: `${base}/analytics`, show: can("analytics", "view"),
      foot:
        g === null ? <>{c.viewsThisMonth.toLocaleString()} this month</> : (
          <><span className={g >= 0 ? "dash-positive" : "dash-negative"}>{g >= 0 ? "↑" : "↓"} {Math.abs(g)}%</span> vs last month</>
        ),
    },
    {
      key: "posts", label: "Blog Posts", value: c.publishedPosts, icon: ICONS.post, href: `${base}/blog`, show: can("blog", "view"),
      foot: <>{c.draftPosts} draft{c.draftPosts === 1 ? "" : "s"}{c.pendingPosts > 0 ? ` · ${c.pendingPosts} pending` : ""}</>,
    },
    {
      key: "projects", label: "Portfolio", value: c.projects, icon: ICONS.portfolio, href: `${base}/portfolio`, show: can("portfolio", "view"),
      foot: <>Total projects</>,
    },
    {
      key: "subscribers", label: "Subscribers", value: c.subscribers, icon: ICONS.users, href: `${base}/newsletter`, show: can("newsletter", "view"),
      foot: <>Active subscribers</>,
    },
    {
      key: "comments", label: "Pending Comments", value: c.pendingComments, icon: ICONS.comment, href: `${base}/comments`, show: can("comments", "view"),
      foot: <>{c.approvedComments} approved</>,
    },
  ];

  const shortcuts = [
    { label: "New Blog Post", href: `${base}/blog/new`, icon: ICONS.edit, show: can("blog", "create") },
    { label: "Add Portfolio", href: `${base}/portfolio/new`, icon: ICONS.grid, show: can("portfolio", "create") },
    { label: "View Contacts", href: `${base}/contacts`, icon: ICONS.person, show: can("contacts", "view") },
    { label: "Media Library", href: `${base}/media`, icon: ICONS.image, show: can("media", "view") },
    { label: "Newsletter", href: `${base}/newsletter`, icon: ICONS.send, show: can("newsletter", "view") },
  ].filter((s) => s.show).slice(0, 5);

  const healthy = system.db.ok && system.uploads;
  const avatarClass = ["", "alt", "third"];

  return (
    <div>
      <div className="dash-welcome">
        <div>
          <Greeting name={firstName} initialHour={(new Date().getUTCHours() + 5) % 24} />
          <p>Here&apos;s what&apos;s happening on your {brand.siteName} site today.</p>
        </div>
        <div>
          <a className="dash-primary-btn" href={env.NEXT_PUBLIC_SITE_URL} target="_blank" rel="noopener noreferrer">
            <span className="inline-flex h-[17px] w-[17px]">{ICONS.external}</span>
            View Site&nbsp; →
          </a>
        </div>
      </div>

      <div className="dash-stats">
        {stats.filter((s) => s.show).map((s) => {
          const d = sparkPath(spark[s.key]);
          return (
            <Link key={s.key} href={s.href} prefetch className="dash-card dash-stat">
              <div className="dash-stat-top">
                <div className="dash-stat-icon">{s.icon}</div>
                <div className="dash-stat-label">{s.label}</div>
              </div>
              <div className="dash-stat-value">{s.value.toLocaleString()}</div>
              <div className="dash-stat-foot">{s.foot}</div>
              {d && (
                <svg className="dash-spark" viewBox="0 0 70 30" aria-hidden>
                  <path d={d} fill="none" stroke="#ed7184" strokeWidth="2" />
                </svg>
              )}
            </Link>
          );
        })}
      </div>

      <div className="dash-mid">
        {can("analytics", "view") || can("dashboard", "view") ? (
          <section className="dash-panel">
            <DashboardChart initial={series} />
          </section>
        ) : <div />}

        <section className="dash-panel dash-quick">
          <div className="dash-panel-head">
            <div className="dash-panel-title">
              <span className="dash-mini-icon" style={{ background: "var(--adm-red)", color: "#fff", width: 43, height: 43 }}>{ICONS.bolt}</span>
              Quick Actions
            </div>
          </div>
          <div className="dash-quick-list">
            {shortcuts.map((s) => (
              <Link key={s.label} href={s.href} prefetch className="dash-quick-action">
                <span className="dash-qa-icon">{s.icon}</span>
                {s.label}
                <span className="arrow">›</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <div className="dash-bottom">
        <section className="dash-panel">
          <div className="dash-panel-head">
            <div className="dash-panel-title">
              <span className="dash-mini-icon">{ICONS.comment}</span>
              Recent Messages
            </div>
            {can("contacts", "view") && (
              <Link className="dash-view-all" href={`${base}/contacts`}>View all&nbsp; →</Link>
            )}
          </div>
          {messages.length === 0 ? (
            <p className="dash-empty">No messages yet — new contact form submissions will show up here.</p>
          ) : (
            messages.map((m, i) => (
              <Link key={m.id} href={`${base}/contacts`} className="dash-msg-row">
                <div className={`dash-person ${avatarClass[i % 3]}`}>{initials(m.name)}</div>
                <strong>{m.name}</strong>
                <div className="dash-msg-text">{m.preview || "(no message)"}</div>
                <div className="dash-msg-time">{relativeTime(m.createdAt)}</div>
                {m.isRead ? <span /> : <span className="dash-unread" title="Unread" />}
              </Link>
            ))
          )}
        </section>

        <section className="dash-panel dash-system">
          <div className="dash-panel-head">
            <div className="dash-panel-title">
              <span className="dash-mini-icon" style={{ background: "#e7f8ed", color: "#159653" }}>{ICONS.shield}</span>
              System Health
            </div>
            <span className={`dash-sys-status${healthy ? "" : " bad"}`}>{healthy ? "All Systems Operational" : "Needs attention"}</span>
          </div>
          <div className="dash-sys-items">
            <div className="dash-sys-item">
              {ICONS.server}
              <strong>Database</strong>
              <small>
                <i className={`dash-live${system.db.ok ? "" : " bad"}`} />
                {system.db.ok ? `Connected · ${system.db.ms}ms` : "Unreachable"}
              </small>
            </div>
            <div className="dash-sys-item">
              {ICONS.upload}
              <strong>Media Uploads</strong>
              <small>
                <i className={`dash-live${system.uploads ? "" : " bad"}`} />
                {system.uploads ? "Active" : "Not writable"}
              </small>
            </div>
            <div className="dash-sys-item">
              {ICONS.clock}
              <strong>Server uptime</strong>
              <small>{uptimeLabel()}</small>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
