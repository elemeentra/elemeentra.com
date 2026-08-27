import { NextRequest, NextResponse } from "next/server";
import { requirePermission, withApiError, ApiError } from "@/lib/api-auth";
import { processAndSaveImage, UploadError } from "@/lib/upload";
import { execute } from "@/lib/db";

export async function POST(request: NextRequest) {
  return withApiError(async () => {
    // Any module that can create/edit content is allowed to upload images
    // for that content — the media table itself is the source of truth,
    // Media Library (Phase 2 later module) just gives it a browsable UI.
    const session = await requirePermission(request, "media", "upload").catch(async (err) => {
      // Fall back to portfolio:create/edit so this endpoint works from the
      // Portfolio form without requiring separate media-module permission.
      if (err instanceof ApiError) {
        return requirePermission(request, "portfolio", "create");
      }
      throw err;
    });

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError(400, "No file provided.");
    }

    let processed;
    try {
      processed = await processAndSaveImage(file);
    } catch (err) {
      if (err instanceof UploadError) throw new ApiError(400, err.message);
      throw err;
    }

    const result = await execute(
      `INSERT INTO media (filename, file_url, thumbnail_url, blur_placeholder, file_size, width, height, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        processed.filename,
        processed.fileUrl,
        processed.thumbnailUrl,
        processed.blurPlaceholder,
        processed.fileSize,
        processed.width,
        processed.height,
        session.userId,
      ]
    );

    return NextResponse.json({
      id: result.insertId,
      url: processed.fileUrl,
      thumbnailUrl: processed.thumbnailUrl,
      blurPlaceholder: processed.blurPlaceholder,
      width: processed.width,
      height: processed.height,
    });
  });
}
