import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { getBlogColumns } from "@/lib/blog-columns";
import {
  PAGE_SIZE,
  buildPagination,
  getPageParams,
  idsSchema,
  likeTerm,
  placeholders,
} from "@/lib/api-utils";

export interface ContactRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  service_interested: string | null;
  message: string | null;
  is_read: number;
  replied: number;
  replied_at: string | null;
  reply_message?: string | null;
  ip_address: string | null;
  created_at: string | null;
}


interface CountResult extends RowDataPacket {
  total: number;
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "contacts", "view");
    const cols = await getBlogColumns();
    const trashed = cols.contactTrash ? "is_trashed" : "0";

    const search = request.nextUrl.searchParams.get("search")?.trim() ?? "";
    const tab = request.nextUrl.searchParams.get("status") ?? "all";
    const { page, offset } = getPageParams(request);

    const whereParts: string[] = [];
    const params: unknown[] = [];

    if (search) {
      const like = likeTerm(search);
      whereParts.push("(name LIKE ? OR email LIKE ? OR phone LIKE ? OR service_interested LIKE ? OR message LIKE ?)");
      params.push(like, like, like, like, like);
    }
    // Every tab except Trash hides trashed messages.
    if (tab === "trash") whereParts.push(`${trashed} = 1`);
    else whereParts.push(`${trashed} = 0`);
    if (tab === "unread") whereParts.push("is_read = 0");
    else if (tab === "read") whereParts.push("is_read = 1");
    else if (tab === "replied") whereParts.push("replied = 1");
    else if (tab === "awaiting") whereParts.push("replied = 0");

    const whereClause = "WHERE " + whereParts.join(" AND ");

    const [countRows, rows, statsRows] = await Promise.all([
      query<CountResult>(`SELECT COUNT(*) AS total FROM contact_messages ${whereClause}`, params),
      query<ContactRow>(
        `SELECT id, name, email, phone, service_interested, message, is_read, replied,
                replied_at, ip_address, created_at${cols.contactReply ? ", reply_message" : ""}
         FROM contact_messages
         ${whereClause}
         ORDER BY created_at DESC, id DESC
         LIMIT ? OFFSET ?`,
        [...params, PAGE_SIZE, offset]
      ),
      query<RowDataPacket & { total: number; unread: string | number | null; read_n: string | number | null; replied_n: string | number | null; trash: string | number | null; awaiting: string | number | null }>(
        `SELECT SUM(${trashed} = 0) AS total,
                SUM(${trashed} = 0 AND is_read = 0) AS unread,
                SUM(${trashed} = 0 AND is_read = 1) AS read_n,
                SUM(${trashed} = 0 AND replied = 1) AS replied_n,
                SUM(${trashed} = 0 AND replied = 0) AS awaiting,
                SUM(${trashed} = 1) AS trash
         FROM contact_messages`
      ),
    ]);

    const total = countRows[0]?.total ?? 0;
    const s = statsRows[0];
    return NextResponse.json({
      items: rows.map((r) => ({ ...r, is_read: Boolean(r.is_read), replied: Boolean(r.replied) })),
      pagination: buildPagination(page, total),
      counts: {
        all: Number(s?.total ?? 0),
        unread: Number(s?.unread ?? 0),
        read: Number(s?.read_n ?? 0),
        replied: Number(s?.replied_n ?? 0),
        trash: Number(s?.trash ?? 0),
      },
      // kept for older callers (dashboard etc.)
      stats: { total: Number(s?.total ?? 0), unread: Number(s?.unread ?? 0), awaiting: Number(s?.awaiting ?? 0) },
      trashAvailable: cols.contactTrash,
    });
  });
}

const bulkDeleteSchema = z.object({ ids: idsSchema });

export async function DELETE(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "contacts", "delete");

    const parsed = bulkDeleteSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids } = parsed.data;
    const result = await execute(
      `DELETE FROM contact_messages WHERE id IN (${placeholders(ids.length)})`,
      ids
    );

    return NextResponse.json({ success: true, deleted: result.affectedRows });
  });
}

const bulkActionSchema = z.object({
  ids: idsSchema,
  action: z.enum(["read", "unread", "replied", "unreplied", "trash", "restore"]),
});

const BULK_SET: Record<z.infer<typeof bulkActionSchema>["action"], string> = {
  read: "is_read = 1",
  unread: "is_read = 0",
  replied: "is_read = 1, replied = 1, replied_at = COALESCE(replied_at, NOW())",
  unreplied: "replied = 0, replied_at = NULL",
  trash: "is_trashed = 1",
  restore: "is_trashed = 0",
};

/** Bulk read / replied state — used by the Bulk Actions dropdown. */
export async function PATCH(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "contacts", "reply");

    const parsed = bulkActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const { ids, action } = parsed.data;
    if ((action === "trash" || action === "restore") && !(await getBlogColumns()).contactTrash) {
      return NextResponse.json(
        { error: "Trash needs migration 009 (contact_messages.is_trashed). Run database/migration/009_blog_parity.sql first." },
        { status: 400 }
      );
    }
    const result = await execute(
      `UPDATE contact_messages SET ${BULK_SET[action]} WHERE id IN (${placeholders(ids.length)})`,
      ids
    );

    return NextResponse.json({ success: true, updated: result.affectedRows });
  });
}
