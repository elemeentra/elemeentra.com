import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Sharp, type Metadata, type OutputInfo } from "sharp";

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB before processing
const MAX_DIMENSION = 2400; // full-size images are capped at this width/height
const THUMBNAIL_WIDTH = 480;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export interface ProcessedImage {
  filename: string;
  fileUrl: string; // public path, e.g. /uploads/2026/08/xxxx.webp
  thumbnailUrl: string;
  blurPlaceholder: string; // tiny base64 data URL for next/image `blurDataURL`
  width: number;
  height: number;
  fileSize: number;
}

/**
 * Converts an uploaded image to WebP, saves a full-size + thumbnail version
 * under /public/uploads/YYYY/MM/, and returns a tiny base64 blur preview.
 * PRD §29 — Sharp handles WebP conversion + responsive image prep.
 */
export async function processAndSaveImage(file: File): Promise<ProcessedImage> {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new UploadError("Only JPEG, PNG, WebP, or GIF images are allowed.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Image is too large. Maximum size is 10MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const now = new Date();
  const yearMonth = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
  const dir = path.join(UPLOAD_ROOT, yearMonth);
  await mkdir(dir, { recursive: true });

  const id = randomUUID();
  const fullFilename = `${id}.webp`;
  const thumbFilename = `${id}-thumb.webp`;

  // The declared MIME type comes from the client and can be faked, so let sharp
  // decide: anything that isn't a decodable JPEG/PNG/WebP/GIF becomes a clean 400.
  let image: Sharp;
  let metadata: Metadata;
  let full: { data: Buffer; info: OutputInfo };
  let thumb: Buffer;
  let blurBuffer: Buffer;
  try {
    image = sharp(buffer).rotate(); // .rotate() auto-orients per EXIF
    metadata = await image.metadata();
    if (!metadata.format || !["jpeg", "png", "webp", "gif"].includes(metadata.format)) {
      throw new UploadError("Only JPEG, PNG, WebP, or GIF images are allowed.");
    }

    full = await image
      .clone()
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    thumb = await image
      .clone()
      .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toBuffer();

    blurBuffer = await image
      .clone()
      .resize({ width: 16 })
      .webp({ quality: 40 })
      .toBuffer();
  } catch (err) {
    if (err instanceof UploadError) throw err;
    throw new UploadError("That file is not a valid image (or is too large to process).");
  }

  await writeFile(path.join(dir, fullFilename), full.data);
  await writeFile(path.join(dir, thumbFilename), thumb);

  return {
    filename: fullFilename,
    fileUrl: `/uploads/${yearMonth}/${fullFilename}`,
    thumbnailUrl: `/uploads/${yearMonth}/${thumbFilename}`,
    blurPlaceholder: `data:image/webp;base64,${blurBuffer.toString("base64")}`,
    width: metadata.width ?? full.info.width,
    height: metadata.height ?? full.info.height,
    fileSize: full.info.size,
  };
}

/** Resolves a stored `/uploads/...` URL to an absolute path, or null if it points outside the upload root. */
function resolveUploadPath(url: string | null | undefined): string | null {
  if (!url || !url.startsWith("/uploads/")) return null;
  const abs = path.resolve(UPLOAD_ROOT, url.slice("/uploads/".length));
  // Path-traversal guard: never touch anything outside public/uploads.
  if (!abs.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return abs;
}

async function unlinkIfExists(abs: string): Promise<boolean> {
  try {
    await unlink(abs);
    return true;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return true; // already gone — fine
    console.error("Failed to delete upload file:", abs, err);
    return false;
  }
}

/**
 * Removes the full-size image and its thumbnail from disk. Missing files are
 * treated as success; returns false if any file could not be removed.
 */
export async function deleteImageFiles(fileUrl: string, thumbnailUrl: string | null): Promise<boolean> {
  const targets = [resolveUploadPath(fileUrl), resolveUploadPath(thumbnailUrl)].filter(
    (p): p is string => p !== null
  );
  const results = await Promise.all(targets.map(unlinkIfExists));
  return results.every(Boolean);
}
