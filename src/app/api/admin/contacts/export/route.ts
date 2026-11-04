import { NextRequest, NextResponse } from "next/server";
import { query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError } from "@/lib/api-auth";
import { contactVisibleSql } from "@/lib/blog-columns";

interface ExportRow extends RowDataPacket {
  name: string; email: string; phone: string | null; service_interested: string | null;
  message: string | null; is_read: number; replied: number; created_at: string | null;
}

/** Neutralises spreadsheet formula injection (=, +, -, @, tab, CR) and quotes the cell. */
function csvCell(value: string | null): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  return withApiError(async () => {
    await requirePermission(request, "contacts", "export");

    const rows = await query<ExportRow>(
      `SELECT name, email, phone, service_interested, message, is_read, replied, created_at
       FROM contact_messages WHERE ${await contactVisibleSql()} ORDER BY created_at DESC, id DESC`
    );

    const lines = ["Name,Email,Phone,Service,Message,Read,Replied,Received At"];
    for (const r of rows) {
      lines.push([
        csvCell(r.name), csvCell(r.email), csvCell(r.phone), csvCell(r.service_interested),
        csvCell(r.message), csvCell(r.is_read ? "yes" : "no"), csvCell(r.replied ? "yes" : "no"),
        csvCell(r.created_at),
      ].join(","));
    }

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse("\uFEFF" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contact-messages-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
