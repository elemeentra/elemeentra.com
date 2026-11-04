import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Serves files from public/uploads at request time. In production Next.js only
 * serves public/ files that existed at build time, so images uploaded through
 * the admin panel afterwards would 404 without this handler. (In dev, and for
 * files that existed at build, the static file wins before this route runs.)
 */
const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

const TYPES: Record<string, string> = {
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
};

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  const rel = params.path.join("/");
  const type = TYPES[path.extname(rel).toLowerCase()];
  if (!type) return new NextResponse("Not found", { status: 404 });

  // Resolve and make sure the result stays inside the uploads folder (no ../ tricks).
  const full = path.resolve(UPLOAD_ROOT, rel);
  if (full !== UPLOAD_ROOT && !full.startsWith(UPLOAD_ROOT + path.sep)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const data = await readFile(full);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
