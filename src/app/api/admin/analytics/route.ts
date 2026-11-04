import { NextRequest, NextResponse } from "next/server";
import { requirePermission, withApiError } from "@/lib/api-auth";
import {
  loadOverviewStats,
  loadDailyViews,
  loadTopPages,
  loadDeviceBreakdown,
  loadCountryBreakdown,
  loadRecentContacts,
} from "@/lib/analytics";

/**
 * GET /api/admin/analytics?range=30
 * Returns all analytics data in one payload.
 */
export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "analytics", "view");

    // parseInt tolerates "7d"; NaN/garbage falls back to 30 so it never reaches SQL.
    const parsed = parseInt(request.nextUrl.searchParams.get("range") ?? "30", 10);
    const range = Math.min(365, Math.max(7, Number.isFinite(parsed) ? parsed : 30));

    const [overview, daily, topPages, devices, countries, recentContacts] =
      await Promise.all([
        loadOverviewStats(),
        loadDailyViews(range),
        loadTopPages(10),
        loadDeviceBreakdown(),
        loadCountryBreakdown(10),
        loadRecentContacts(5),
      ]);

    return NextResponse.json({ overview, daily, topPages, devices, countries, recentContacts });
  });
}
