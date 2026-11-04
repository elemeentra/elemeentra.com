import { NextRequest, NextResponse } from "next/server";
import { query, type RowDataPacket } from "@/lib/db";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { parseId } from "@/lib/api-utils";
import { deleteMedia, findMediaUsage } from "@/lib/media-usage";

interface MediaDetailRow extends RowDataPacket {
  id: number;
  filename: string;
  file_url: string;
  thumbnail_url: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  uploaded_by: number | null;
  uploaded_at: string | null;
  uploader_name: string | null;
}

/** Single file + exactly where it's used (powers the details panel). */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "media", "view");
    const id = parseId(params.id, "media");

    const rows = await query<MediaDetailRow>(
      `SELECT m.id, m.filename, m.file_url, m.thumbnail_url, m.file_size, m.width, m.height,
              m.uploaded_by, m.uploaded_at, u.name AS uploader_name
       FROM media m
       LEFT JOIN users u ON u.id = m.uploaded_by
       WHERE m.id = ?
       LIMIT 1`,
      [id]
    );
    const item = rows[0];
    if (!item) throw new ApiError(404, "File not found.");

    const usage = await findMediaUsage([item]);
    return NextResponse.json({ item: { ...item, usages: usage.get(item.id) ?? [] } });
  });
}

/** Delete one file from the DB and disk. `?force=1` skips the in-use warning (409). */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  return withApiError(async () => {
    await requirePermission(request, "media", "delete");
    const id = parseId(params.id, "media");
    const force = request.nextUrl.searchParams.get("force") === "1";

    const result = await deleteMedia([id], force);
    if (!result.ok) {
      return NextResponse.json(
        { error: "This file is still in use.", inUse: result.inUse },
        { status: 409 }
      );
    }
    if (result.deleted === 0) throw new ApiError(404, "File not found.");

    return NextResponse.json({ success: true, fileErrors: result.fileErrors });
  });
}
