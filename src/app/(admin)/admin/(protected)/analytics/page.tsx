import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  Eye, Mail, Users, MessageSquare,
  FileText, Briefcase, MonitorSmartphone, Globe,
} from "lucide-react";
import { getFreshSession } from "@/lib/api-auth";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { getEnv } from "@/lib/env";
import {
  loadOverviewStats,
  loadDailyViews,
  loadTopPages,
  loadDeviceBreakdown,
  loadCountryBreakdown,
  loadRecentContacts,
} from "@/lib/analytics";
import { StatCard }           from "@/components/admin/analytics/StatCard";
import { TrendChart }         from "@/components/admin/analytics/TrendChart";
import { TopPagesTable }      from "@/components/admin/analytics/TopPagesTable";
import { DeviceDonut }        from "@/components/admin/analytics/DeviceDonut";
import { CountryTable }       from "@/components/admin/analytics/CountryTable";
import { RecentContactsList } from "@/components/admin/analytics/RecentContactsList";
import { RangeSelector }      from "@/components/admin/analytics/RangeSelector";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: { range?: string };
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const session = await getFreshSession();
  if (!session || !hasPermission(session.permissions, session.roleName === SUPER_ADMIN_ROLE, "analytics", "view")) {
    notFound();
  }

  const range = Math.min(365, Math.max(7, Number(searchParams.range ?? "30") || 30));
  const env   = getEnv();
  const adminBase = `/${env.ADMIN_PATH}`;

  // Load all data in parallel; each helper fails soft (returns empty/zero) if
  // the page_views table doesn't exist yet (fresh install before migration runs).
  const [overview, daily, topPages, devices, countries, recentContacts] =
    await Promise.allSettled([
      loadOverviewStats(),
      loadDailyViews(range),
      loadTopPages(10),
      loadDeviceBreakdown(),
      loadCountryBreakdown(10),
      loadRecentContacts(5),
    ]).then((results) =>
      results.map((r) => (r.status === "fulfilled" ? r.value : null))
    ) as [
      Awaited<ReturnType<typeof loadOverviewStats>> | null,
      Awaited<ReturnType<typeof loadDailyViews>> | null,
      Awaited<ReturnType<typeof loadTopPages>> | null,
      Awaited<ReturnType<typeof loadDeviceBreakdown>> | null,
      Awaited<ReturnType<typeof loadCountryBreakdown>> | null,
      Awaited<ReturnType<typeof loadRecentContacts>> | null,
    ];

  const ov = overview ?? {
    totalPageViews: 0, pageViewsThisMonth: 0, pageViewsLastMonth: 0, pageViewsGrowth: null,
    totalContacts: 0, contactsThisMonth: 0, unreadContacts: 0,
    totalSubscribers: 0, subscribersThisMonth: 0, unsubscribesThisMonth: 0,
    totalComments: 0, pendingComments: 0,
    publishedPosts: 0, publishedProjects: 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="mt-1 text-sm text-muted">Site performance and content overview.</p>
        </div>
        <Suspense>
          <RangeSelector current={range} />
        </Suspense>
      </div>

      {/* Stat cards row 1 — page views */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Page Views"     value={ov.totalPageViews}      icon={Eye}     accent growth={ov.pageViewsGrowth} />
        <StatCard label="Views This Month"     value={ov.pageViewsThisMonth}  icon={Eye}     sub={`${ov.pageViewsLastMonth.toLocaleString()} last month`} />
        <StatCard label="Contacts"             value={ov.totalContacts}       icon={Mail}    sub={`${ov.contactsThisMonth} this month · ${ov.unreadContacts} unread`} />
        <StatCard label="Newsletter"           value={ov.totalSubscribers}    icon={Users}   sub={`+${ov.subscribersThisMonth} this month`} />
      </div>

      {/* Stat cards row 2 — content */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Comments"             value={ov.totalComments}       icon={MessageSquare} sub={`${ov.pendingComments} pending`} />
        <StatCard label="Published Posts"      value={ov.publishedPosts} icon={FileText} sub="blog" />
        <StatCard label="Projects"             value={ov.publishedProjects}   icon={Briefcase} />
        <StatCard label="Unsubscribes"         value={ov.unsubscribesThisMonth} icon={Users} sub="this month" />
      </div>

      {/* Trend chart */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-foreground">Page Views — Last {range} Days</h2>
        {daily && daily.length > 0 ? (
          <TrendChart data={daily} days={range} />
        ) : (
          <div className="flex h-28 items-center justify-center rounded-xl bg-surface text-sm text-muted">
            No page view data yet. Add <code className="mx-1 rounded bg-border/50 px-1 text-xs">/api/track</code> calls to your public pages to start collecting data.
          </div>
        )}
      </div>

      {/* Bottom row: top pages, devices, countries, recent contacts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Top pages — takes 2 cols */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Top Pages</h2>
          <TopPagesTable rows={topPages ?? []} />
        </div>

        {/* Devices */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <MonitorSmartphone className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold text-foreground">Devices</h2>
          </div>
          <DeviceDonut rows={devices ?? []} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        {/* Countries */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Globe className="h-4 w-4 text-muted" />
            <h2 className="text-sm font-semibold text-foreground">Top Countries</h2>
          </div>
          <CountryTable rows={countries ?? []} />
        </div>

        {/* Recent contacts */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">Recent Contacts</h2>
            <a href={`${adminBase}/contacts`} className="text-xs text-crimson hover:underline">View all →</a>
          </div>
          <RecentContactsList rows={recentContacts ?? []} />
        </div>
      </div>

      {/* Setup hint */}
      <div className="rounded-xl border border-border bg-surface px-4 py-3 text-xs text-muted">
        <strong className="text-foreground">Tracking setup:</strong> Call{" "}
        <code className="rounded bg-border/50 px-1">POST /api/track</code> with{" "}
        <code className="rounded bg-border/50 px-1">{"{ path: window.location.pathname }"}</code> from
        your public layout to start recording page views. No cookies, no PII.
      </div>
    </div>
  );
}
