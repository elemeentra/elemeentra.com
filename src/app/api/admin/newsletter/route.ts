import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import {
  PAGE_SIZE,
  buildPagination,
  getPageParams,
  idsSchema,
  likeTerm,
  placeholders,
} from "@/lib/api-utils";

export interface SubscriberRow extends RowDataPacket {
  id: number;
  email: string;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
}

interface StatsRow extends RowDataPacket {
  total: number;
  active: string | number | null;
  unsubscribed: string | number | null;
}

interface CountResult extends RowDataPacket {
  total: number;
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "newsletter", "view");

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const statusFilter = request.nextUrl.searchParams.get("status") ?? "";
    const { page, offset } = getPageParams(request);

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (search) {
      whereParts.push("email LIKE ?");
      params.push(likeTerm(search));
    }
    if (statusFilter === "active") whereParts.push("unsubscribed_at IS NULL");
    if (statusFilter === "unsubscribed") whereParts.push("unsubscribed_at IS NOT NULL");

    const whereClause = whereParts.length > 0 ? "WHERE " + whereParts.join(" AND ") : "";

    // unsubscribe_token is deliberately NOT selected — it's a secret that
    // authorises unsubscribing and has no business in the admin list payload.
    const [countRows, rows, statsRows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM newsletter_subscribers ${whereClause}`, params),
      query<SubscriberRow>(
        `SELECT id, email, subscribed_at, unsubscribed_at
         FROM newsletter_subscribers
         ${whereClause}
         ORDER BY subscribed_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset]
      ),
      query<StatsRow>(
        `SELECT COUNT(*) AS total,
                SUM(unsubscribed_at IS NULL) AS active,
                SUM(unsubscribed_at IS NOT NULL) AS unsubscribed
         FROM newsletter_subscribers`
      ),
    ]);

    const total = countRows[0]?.total ?? 0;
    const s = statsRows[0];

    return NextResponse.json({
      items: rows,
      pagination: buildPagination(page, total),
      stats: {
        total: Number(s?.total ?? 0),
        active: Number(s?.active ?? 0),
        unsubscribed: Number(s?.unsubscribed ?? 0),
      },
    });
  });
}

const bulkDeleteSchema = z.object({ ids: idsSchema });

export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "newsletter", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids } = parsed.data;
    const result = await execute(
      `DELETE FROM newsletter_subscribers WHERE id IN (${placeholders(ids.length)})`,
      ids
    );

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

const bulkActionSchema = z.object({
  ids: idsSchema,
  action: z.enum(["unsubscribe", "resubscribe"]),
});

/** Bulk unsubscribe / resubscribe — used by the Bulk Actions dropdown. */
export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "newsletter", "edit");

    const parsed = bulkActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids, action } = parsed.data;
    const setClause =
      action === "unsubscribe" ? "unsubscribed_at = COALESCE(unsubscribed_at, NOW())" : "unsubscribed_at = NULL";
    const result = await execute(
      `UPDATE newsletter_subscribers SET ${setClause} WHERE id IN (${placeholders(ids.length)})`,
      ids
    );

    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}
