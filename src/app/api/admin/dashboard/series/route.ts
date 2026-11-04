import { NextRequest, NextResponse } from "next/server";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { loadViewsSeries, type ViewsRange } from "@/lib/dashboard-data";

/** GET /api/admin/dashboard/series?range=30d|90d|1y — page-views chart data. */
export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "dashboard", "view");
    const raw = request.nextUrl.searchParams.get("range");
    const range: ViewsRange = raw === "90d" || raw === "1y" ? raw : "30d";
    return NextResponse.json({ range, series: await loadViewsSeries(range) });
  });
}
