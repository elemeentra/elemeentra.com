import "server-only";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { contactVisibleSql } from "@/lib/blog-columns";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverviewStats {
  totalPageViews: number;
  pageViewsThisMonth: number;
  pageViewsLastMonth: number;
  pageViewsGrowth: number | null; // percentage, null if no last-month data

  totalContacts: number;
  contactsThisMonth: number;
  unreadContacts: number;

  totalSubscribers: number;
  subscribersThisMonth: number;
  unsubscribesThisMonth: number;

  totalComments: number;
  pendingComments: number;

  publishedPosts: number;
  publishedProjects: number;
}

export interface PageViewRow {
  path: string;
  views: number;
}

export interface DailyViewRow {
  date: string; // YYYY-MM-DD
  views: number;
}

export interface DeviceRow {
  device: string;
  views: number;
}

export interface CountryRow {
  country_code: string;
  views: number;
}

export interface RecentContactRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  service_interested: string | null;
  is_read: boolean;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function count(sql: string, params: unknown[] = []): Promise<number> {
  interface C extends RowDataPacket { n: number }
  const rows = await query<C>(sql, params);
  return Number(rows[0]?.n ?? 0);
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export async function loadOverviewStats(): Promise<OverviewStats> {
  const visible = await contactVisibleSql();
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(thisMonthStart.getTime() - 1);

  const fmt = (d: Date) => d.toISOString().slice(0, 19).replace("T", " ");
  const tsm = fmt(thisMonthStart);
  const lms = fmt(lastMonthStart);
  const lme = fmt(lastMonthEnd);

  const [
    totalPV, pvThisMonth, pvLastMonth,
    totalContacts, contactsThisMonth, unreadContacts,
    totalSubs, subsThisMonth, unsubsThisMonth,
    totalComments, pendingComments,
    publishedPosts, publishedProjects,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS n FROM page_views"),
    count("SELECT COUNT(*) AS n FROM page_views WHERE created_at >= ?", [tsm]),
    count("SELECT COUNT(*) AS n FROM page_views WHERE created_at BETWEEN ? AND ?", [lms, lme]),

    count(`SELECT COUNT(*) AS n FROM contact_messages WHERE ${visible}`),
    count(`SELECT COUNT(*) AS n FROM contact_messages WHERE created_at >= ? AND ${visible}`, [tsm]),
    count(`SELECT COUNT(*) AS n FROM contact_messages WHERE is_read = FALSE AND ${visible}`),

    count("SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE unsubscribed_at IS NULL"),
    count("SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE subscribed_at >= ?", [tsm]),
    count("SELECT COUNT(*) AS n FROM newsletter_subscribers WHERE unsubscribed_at >= ?", [tsm]),

    count("SELECT COUNT(*) AS n FROM comments"),
    count("SELECT COUNT(*) AS n FROM comments WHERE approved = FALSE"),

    count("SELECT COUNT(*) AS n FROM posts WHERE status = 'published'"),
    count("SELECT COUNT(*) AS n FROM projects"),
  ]);

  const growth =
    pvLastMonth === 0
      ? null
      : Math.round(((pvThisMonth - pvLastMonth) / pvLastMonth) * 100);

  return {
    totalPageViews: totalPV,
    pageViewsThisMonth: pvThisMonth,
    pageViewsLastMonth: pvLastMonth,
    pageViewsGrowth: growth,
    totalContacts,
    contactsThisMonth,
    unreadContacts,
    totalSubscribers: totalSubs,
    subscribersThisMonth: subsThisMonth,
    unsubscribesThisMonth: unsubsThisMonth,
    totalComments,
    pendingComments,
    publishedPosts,
        publishedProjects,
  };
}

// ---------------------------------------------------------------------------
// Page views — last N days trend
// ---------------------------------------------------------------------------

export async function loadDailyViews(days = 30): Promise<DailyViewRow[]> {
  interface R extends RowDataPacket { date: string; views: number }
  const rows = await query<R>(
    `SELECT DATE(created_at) AS date, COUNT(*) AS views
     FROM page_views
     WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    [days]
  );
  return rows.map((r) => ({ date: r.date, views: Number(r.views) }));
}

// ---------------------------------------------------------------------------
// Top pages
// ---------------------------------------------------------------------------

export async function loadTopPages(limit = 10): Promise<PageViewRow[]> {
  interface R extends RowDataPacket { path: string; views: number }
  const rows = await query<R>(
    `SELECT path, COUNT(*) AS views
     FROM page_views
     GROUP BY path
     ORDER BY views DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({ path: r.path, views: Number(r.views) }));
}

// ---------------------------------------------------------------------------
// Device breakdown
// ---------------------------------------------------------------------------

export async function loadDeviceBreakdown(): Promise<DeviceRow[]> {
  interface R extends RowDataPacket { device: string; views: number }
  const rows = await query<R>(
    `SELECT device, COUNT(*) AS views FROM page_views GROUP BY device ORDER BY views DESC`
  );
  return rows.map((r) => ({ device: r.device, views: Number(r.views) }));
}

// ---------------------------------------------------------------------------
// Country breakdown (top 10)
// ---------------------------------------------------------------------------

export async function loadCountryBreakdown(limit = 10): Promise<CountryRow[]> {
  interface R extends RowDataPacket { country_code: string; views: number }
  const rows = await query<R>(
    `SELECT COALESCE(country_code,'??') AS country_code, COUNT(*) AS views
     FROM page_views
     WHERE country_code IS NOT NULL
     GROUP BY country_code
     ORDER BY views DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({ country_code: r.country_code, views: Number(r.views) }));
}

// ---------------------------------------------------------------------------
// Recent contacts (last 5, for the quick-view panel)
// ---------------------------------------------------------------------------

export async function loadRecentContacts(limit = 5): Promise<RecentContactRow[]> {
  return query<RecentContactRow>(
    `SELECT id, name, email, service_interested, is_read, created_at
     FROM contact_messages
     ORDER BY created_at DESC
     LIMIT ?`,
    [limit]
  );
}

// ---------------------------------------------------------------------------
// Public tracker — called from /api/track route
// ---------------------------------------------------------------------------

export async function recordPageView(data: {
  path: string;
  referrer: string | null;
  country_code: string | null;
  device: "desktop" | "mobile" | "tablet" | "unknown";
}): Promise<void> {
  await execute(
    "INSERT INTO page_views (path, referrer, country_code, device) VALUES (?, ?, ?, ?)",
    [data.path, data.referrer, data.country_code, data.device]
  );
}
