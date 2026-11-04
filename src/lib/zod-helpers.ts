import { z } from "zod";

/** Optional trimmed text — an empty string (or missing value) becomes null. */
export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Optional http(s) URL — an empty string becomes null instead of failing URL validation. */
export const optionalHttpUrl = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || isHttpUrl(v), "Must be a valid http(s) URL");

/** Optional image reference — a Media Library path (/uploads/...) or an http(s) URL; empty becomes null. */
export const optionalImageUrl = (max = 255) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine(
      (v) => v === null || (v.startsWith("/uploads/") && !v.includes("..")) || isHttpUrl(v),
      "Must be an uploaded image or a valid URL"
    );

/** Required http(s) URL. */
export const requiredHttpUrl = (max = 255) =>
  z.string().trim().min(1, "URL is required").max(max).refine(isHttpUrl, "Must be a valid http(s) URL");

/** Optional email address — an empty string becomes null instead of failing email validation. */
export const optionalEmail = (max = 150) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address");
