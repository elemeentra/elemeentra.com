import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { parseId } from "@/lib/api-utils";

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "newsletter", "delete");
    const id = parseId(params.id, "subscriber");

    const result = await execute("DELETE FROM newsletter_subscribers WHERE id = ?", [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Subscriber not found.");

    return NextResponse.json({ success: true });
  });
}

const quickEditSchema = z.object({
  subscribed: z.boolean(),
});

/** Toggle a subscriber between active and unsubscribed. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "newsletter", "edit");
    const id = parseId(params.id, "subscriber");

    const parsed = quickEditSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input." }, { status: 400 });
    }

    const setClause = parsed.data.subscribed
      ? "unsubscribed_at = NULL"
      : "unsubscribed_at = COALESCE(unsubscribed_at, NOW())";
    const result = await execute(`UPDATE newsletter_subscribers SET ${setClause} WHERE id = ?`, [id]);
    if (result.affectedRows === 0) throw new ApiError(404, "Subscriber not found.");

    return NextResponse.json({ success: true });
  });
}
