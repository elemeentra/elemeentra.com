import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute, query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { parseId } from "@/lib/api-utils";
import { getBlogColumns } from "@/lib/blog-columns";
import { loadGeneralSettings } from "@/lib/settings";
import { sendMail, escapeHtml } from "@/lib/mailer";

const schema = z.object({
  subject: z.string().trim().min(1, "Subject is required.").max(200),
  message: z.string().trim().min(1, "Message is required.").max(10000),
});

interface ContactRow extends RowDataPacket { id: number; name: string; email: string; message: string | null; created_at: string | null }

/** Sends an email reply to the person who used the contact form, then marks the message replied. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "contacts", "reply");
    const id = parseId(params.id, "message");

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }

    const rows = await query<ContactRow>(
      "SELECT id, name, email, message, created_at FROM contact_messages WHERE id = ? LIMIT 1", [id]
    );
    const contact = rows[0];
    if (!contact) throw new ApiError(404, "Message not found.");

    const settings = await loadGeneralSettings().catch(() => null);
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111">
      <div style="white-space:pre-wrap">${escapeHtml(parsed.data.message)}</div>
      <hr style="border:none;border-top:1px solid #ddd;margin:24px 0" />
      <div style="color:#666;font-size:12px">On ${escapeHtml(contact.created_at ?? "")}, ${escapeHtml(contact.name)} wrote:</div>
      <blockquote style="margin:8px 0 0;padding-left:12px;border-left:3px solid #ddd;color:#555;white-space:pre-wrap">${escapeHtml(contact.message ?? "")}</blockquote>
    </div>`;

    const sent = await sendMail({
      to: contact.email,
      subject: parsed.data.subject,
      html,
      replyTo: settings?.contact_email || undefined,
    });
    if (!sent) {
      // Don't mark it replied if nothing was sent.
      return NextResponse.json(
        { error: "The email could not be sent. Check the SMTP settings (SMTP_HOST, SMTP_USER, SMTP_PASSWORD) in .env.local." },
        { status: 502 }
      );
    }

    const cols = await getBlogColumns();
    await execute(
      `UPDATE contact_messages SET is_read = 1, replied = 1, replied_at = NOW()${cols.contactReply ? ", reply_message = ?" : ""} WHERE id = ?`,
      cols.contactReply ? [parsed.data.message, id] : [id]
    );
    return NextResponse.json({ success: true });
  });
}
