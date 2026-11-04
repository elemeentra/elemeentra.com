import { NextRequest, NextResponse } from "next/server";
import { getFreshSession, withApiError } from "@/lib/api-auth";
import { hasPermission, SUPER_ADMIN_ROLE } from "@/lib/permissions";
import { loadDashboardCounts } from "@/lib/dashboard-data";

/**
 * GET /api/admin/notifications — what needs attention (for the top-bar bell).
 * Reads the same 15s-cached counts the dashboard uses, so polling is nearly free.
 */
export async function GET(request: NextRequest) {
  return withApiError(async () => {
    const session = await getFreshSession(request);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const isSuper = session.roleName === SUPER_ADMIN_ROLE;
    const can = (m: Parameters<typeof hasPermission>[2]) => hasPermission(session.permissions, isSuper, m, "view");

    const c = await loadDashboardCounts();
    const items = [
      can("contacts") && c.unreadContacts > 0 && { key: "contacts", label: "Unread messages", count: c.unreadContacts, href: "contacts" },
      can("comments") && c.pendingComments > 0 && { key: "comments", label: "Comments awaiting approval", count: c.pendingComments, href: "comments" },
      can("reviews") && c.pendingReviews > 0 && { key: "reviews", label: "Reviews awaiting approval", count: c.pendingReviews, href: "reviews" },
      can("blog") && c.pendingPosts > 0 && { key: "posts", label: "Posts pending review", count: c.pendingPosts, href: "blog" },
    ].filter(Boolean);

    const total = (items as { count: number }[]).reduce((n, i) => n + i.count, 0);
    return NextResponse.json({ total, items });
  });
}
