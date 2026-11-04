import "server-only";
import { query, type RowDataPacket } from "@/lib/db";
import { contactVisibleSql } from "@/lib/blog-columns";

/**
 * Dashboard data layer.
 *
 * Speed note: the old dashboard fired ~16 separate queries per visit, each one a
 * network round-trip to the remote database, waiting in waves because the pool
 * only has 10 connections. Everything countable now comes back from ONE query
 * (scalar sub-selects), results are cached for a few seconds, and if a table is
 * missing the code falls back to per-count queries so one bad table never breaks
 * the whole page.
 */

export interface DashboardCounts {
  projects: number;
  publishedPosts: number;
  draftPosts: number;
  pendingPosts: number;
  unreadContacts: number;
  totalContacts: number;
  subscribers: number;
  pendingComments: number;
  approvedComments: number;
  pendingReviews: number;
  teamMembers: number;
  activeUsers: number;
  pageViews: number;
  viewsThisMonth: number;
  viewsLastMonth: number;
}

const ZERO: DashboardCounts = {
  projects: 0, publishedPosts: 0, draftPosts: 0, pendingPosts: 0, unreadContacts: 0, totalContacts: 0,
  subscribers: 0, pendingComments: 0, approvedComments: 0, pendingReviews: 0, teamMembers: 0,
  activeUsers: 0, pageViews: 0, viewsThisMonth: 0, viewsLastMonth: 0,
};

const MONTH_START = "DATE_FORMAT(CURDATE(), '%Y-%m-01')";
const PREV_MONTH_START = `DATE_SUB(${MONTH_START}, INTERVAL 1 MONTH)`;

function countSql(visible: string): Record<keyof DashboardCounts, string> {
  return {
    projects: "SELECT COUNT(*) FROM projects",
    publishedPosts: "SELECT COUNT(*) FROM posts WHERE status = 'published'",
    draftPosts: "SELECT COUNT(*) FROM posts WHERE status = 'draft'",
    pendingPosts: "SELECT COUNT(*) FROM posts WHERE status = 'pending'",
    unreadContacts: `SELECT COUNT(*) FROM contact_messages WHERE is_read = FALSE AND ${visible}`,
    totalContacts: `SELECT COUNT(*) FROM contact_messages WHERE ${visible}`,
    subscribers: "SELECT COUNT(*) FROM newsletter_subscribers WHERE unsubscribed_at IS NULL",
    pendingComments: "SELECT COUNT(*) FROM comments WHERE approved = FALSE",
    approvedComments: "SELECT COUNT(*) FROM comments WHERE approved = TRUE",
    pendingReviews: "SELECT COUNT(*) FROM reviews WHERE status = 'pending'",
    teamMembers: "SELECT COUNT(*) FROM team_members",
    activeUsers: "SELECT COUNT(*) FROM users WHERE status = 'active'",
    pageViews: "SELECT COUNT(*) FROM page_views",
    viewsThisMonth: `SELECT COUNT(*) FROM page_views WHERE created_at >= ${MONTH_START}`,
    viewsLastMonth: `SELECT COUNT(*) FROM page_views WHERE created_at >= ${PREV_MONTH_START} AND created_at < ${MONTH_START}`,
  };
}

const TTL_MS = 15_000;
let countsCache: { at: number; value: Promise<DashboardCounts> } | null = null;

export function invalidateDashboardCache(): void {
  countsCache = null;
}

export function loadDashboardCounts(): Promise<DashboardCounts> {
  if (countsCache && Date.now() - countsCache.at < TTL_MS) return countsCache.value;
  const value = readCounts();
  countsCache = { at: Date.now(), value };
  value.catch(() => {
    if (countsCache?.value === value) countsCache = null;
  });
  return value;
}

async function readCounts(): Promise<DashboardCounts> {
  const visible = await contactVisibleSql();
  const defs = countSql(visible);
  const keys = Object.keys(defs) as (keyof DashboardCounts)[];

  try {
    const select = keys.map((k) => `(${defs[k]}) AS ${k}`).join(",\n       ");
    const rows = await query<RowDataPacket>(`SELECT ${select}`);
    const out = { ...ZERO };
    for (const k of keys) out[k] = Number(rows[0]?.[k] ?? 0);
    return out;
  } catch {
    // A table is missing/unreadable — count each thing on its own so the rest still shows.
    const out = { ...ZERO };
    await Promise.all(
      keys.map(async (k) => {
        try {
          const rows = await query<RowDataPacket>(`SELECT (${defs[k]}) AS n`);
          out[k] = Number(rows[0]?.n ?? 0);
        } catch {
          out[k] = 0;
        }
      })
    );
    return out;
  }
}

/** Percent change vs last month, or null when there is nothing to compare to. */
export function growth(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

// ---------------------------------------------------------------------------
// Time series
// ---------------------------------------------------------------------------

export type ViewsRange = "30d" | "90d" | "1y";
export interface SeriesPoint {
  label: string;
  views: number;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const shortDate = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, "0")}`;
const utcToday = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()));
};

async function fetchMap(sql: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  try {
    const rows = await query<RowDataPacket>(sql);
    for (const r of rows) map.set(String(r.k), Number(r.n));
  } catch {
    /* page_views table missing → flat zero series */
  }
  return map;
}

export async function loadViewsSeries(range: ViewsRange): Promise<SeriesPoint[]> {
  const today = utcToday();

  if (range === "30d") {
    const map = await fetchMap(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS k, COUNT(*) AS n FROM page_views
       WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 29 DAY) GROUP BY k`
    );
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setUTCDate(d.getUTCDate() - (29 - i));
      return { label: shortDate(d), views: map.get(ymd(d)) ?? 0 };
    });
  }

  if (range === "90d") {
    // weekly buckets, week starts Monday
    const map = await fetchMap(
      `SELECT DATE_FORMAT(DATE_SUB(DATE(created_at), INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d') AS k, COUNT(*) AS n
       FROM page_views WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 90 DAY) GROUP BY k`
    );
    const monday = new Date(today);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    return Array.from({ length: 13 }, (_, i) => {
      const d = new Date(monday);
      d.setUTCDate(d.getUTCDate() - (12 - i) * 7);
      return { label: shortDate(d), views: map.get(ymd(d)) ?? 0 };
    });
  }

  const map = await fetchMap(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS k, COUNT(*) AS n FROM page_views
     WHERE created_at >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 11 MONTH) GROUP BY k`
  );
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (11 - i), 1));
    return { label: `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`, views: map.get(ymd(d).slice(0, 7)) ?? 0 };
  });
}

// ---------------------------------------------------------------------------
// Sparklines (8 weekly buckets) — one round trip for the four content cards
// ---------------------------------------------------------------------------

export type SparkKey = "views" | "posts" | "projects" | "subscribers" | "comments";

export async function loadSparklines(): Promise<Record<SparkKey, number[]>> {
  const empty = () => Array.from({ length: 8 }, () => 0);
  const out: Record<SparkKey, number[]> = { views: empty(), posts: empty(), projects: empty(), subscribers: empty(), comments: empty() };
  const bucket = (col: string) => `FLOOR(DATEDIFF(CURDATE(), DATE(${col})) / 7)`;
  const part = (key: SparkKey, table: string, col: string) =>
    `SELECT '${key}' AS k, ${bucket(col)} AS b, COUNT(*) AS n FROM ${table}
     WHERE ${col} >= DATE_SUB(CURDATE(), INTERVAL 8 WEEK) GROUP BY b`;
  const parts: [SparkKey, string, string][] = [
    ["views", "page_views", "created_at"],
    ["posts", "posts", "created_at"],
    ["projects", "projects", "created_at"],
    ["subscribers", "newsletter_subscribers", "subscribed_at"],
    ["comments", "comments", "created_at"],
  ];

  // One UNION first; if any table/column is off, query each on its own.
  const apply = (rows: RowDataPacket[]) => {
    for (const r of rows) {
      const k = r.k as SparkKey;
      const b = Number(r.b);
      if (out[k] && b >= 0 && b < 8) out[k][7 - b] = Number(r.n); // oldest → newest
    }
  };
  try {
    apply(await query<RowDataPacket>(parts.map((p) => part(...p)).join(" UNION ALL ")));
  } catch {
    await Promise.all(
      parts.map(async (p) => {
        try {
          apply(await query<RowDataPacket>(part(...p)));
        } catch {
          /* leave flat */
        }
      })
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Recent messages
// ---------------------------------------------------------------------------

export interface RecentMessage {
  id: number;
  name: string;
  preview: string;
  isRead: boolean;
  createdAt: string;
}

export async function loadRecentMessages(limit = 4): Promise<RecentMessage[]> {
  try {
    const visible = await contactVisibleSql();
    const rows = await query<RowDataPacket>(
      `SELECT id, name, LEFT(COALESCE(message, ''), 160) AS preview, is_read, created_at
       FROM contact_messages WHERE ${visible} ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return rows.map((r) => ({
      id: Number(r.id),
      name: String(r.name),
      preview: String(r.preview ?? ""),
      isRead: Boolean(r.is_read),
      createdAt: String(r.created_at),
    }));
  } catch {
    return [];
  }
}
