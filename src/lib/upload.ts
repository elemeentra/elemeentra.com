import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

  const image = sharp(buffer).rotate(); // .rotate() auto-orients per EXIF
  const metadata = await image.metadata();

  const full = await image
    .clone()
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await image
    .clone()
    .resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();

  const blurBuffer = await image
    .clone()
    .resize({ width: 16 })
    .webp({ quality: 40 })
    .toBuffer();

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
