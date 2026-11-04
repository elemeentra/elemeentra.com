import { NextRequest, NextResponse } from "next/server";
import { query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";

interface ExportRow extends RowDataPacket {
  email: string;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
}

/** Neutralises spreadsheet formula injection (=, +, -, @, tab, CR) and quotes the cell. */
function csvCell(value: string | null): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "newsletter", "export");

    const statusFilter = request.nextUrl.searchParams.get("status") ?? "";
    let where = "";
    if (statusFilter === "active") where = "WHERE unsubscribed_at IS NULL";
    if (statusFilter === "unsubscribed") where = "WHERE unsubscribed_at IS NOT NULL";

    const rows = await query<ExportRow>(
      `SELECT email, subscribed_at, unsubscribed_at
       FROM newsletter_subscribers
       ${where}
       ORDER BY subscribed_at DESC, id DESC`
    );

    const lines = ["Email,Status,Subscribed At,Unsubscribed At"];
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.email),
          csvCell(r.unsubscribed_at ? "unsubscribed" : "active"),
          csvCell(r.subscribed_at),
          csvCell(r.unsubscribed_at),
        ].join(",")
      );
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse("\uFEFF" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="newsletter-subscribers-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
