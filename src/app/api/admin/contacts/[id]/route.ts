import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { parseId } from "@/lib/api-utils";

interface FullContactRow extends RowDataPacket {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  service_interested: string | null;
  message: string | null;
  is_read: number;
  replied: number;
  replied_at: string | null;
  ip_address: string | null;
  created_at: string | null;
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "contacts", "view");
    const id = parseId(params.id, "message");

    const rows = await query<FullContactRow>("SELECT * FROM contact_messages WHERE id = ? LIMIT 1", [id]);
    const contact = rows[0];
    if (!contact) throw new ApiError(404, "Message not found.");

    return NextResponse.json({
      contact: { ...contact, is_read: Boolean(contact.is_read), replied: Boolean(contact.replied) },
    });
  });
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "contacts", "delete");
    const id = parseId(params.id, "message");

    const result = await execute("DELETE FROM contact_messages WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Message not found.");

    return NextResponse.json({ success: true });
  });
}

const quickEditSchema = z.object({
  is_read: z.boolean().optional(),
  replied: z.boolean().optional(),
});

/** Update read / replied state. Marking replied also marks the message read. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "contacts", "reply");
    const id = parseId(params.id, "message");

    const parsed = quickEditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }
    const data = parsed.data;

    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (data.is_read !== undefined) {
      setClauses.push("is_read = ?");
      values.push(data.is_read ? 1 : 0);
    } else if (data.replied === true) {
      setClauses.push("is_read = 1");
    }
    if (data.replied !== undefined) {
      if (data.replied) {
        setClauses.push("replied = 1", "replied_at = COALESCE(replied_at, NOW())");
      } else {
        setClauses.push("replied = 0", "replied_at = NULL");
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json({ error: "No fields to update." }, { status: 400 });
    }

    const result = await execute(
      `UPDATE contact_messages SET ${setClauses.join(", ")} WHERE id = ?`,
      [...values, id]
    );
    if (result.affectedRows === 0) throw new ApiError(404, "Message not found.");

    return NextResponse.json({ success: true });
  });
}
