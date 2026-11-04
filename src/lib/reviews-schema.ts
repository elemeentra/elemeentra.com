import "server-only";
import { query, execute, type RowDataPacket } from "@/lib/db";

/**
 * The `reviews` table exists in two shapes: the original schema.sql
 * (review_title / review_text, no `featured`) and the shape the admin module
 * was built against (`content` + `featured`). Detect once per process which
 * columns are really there, so every query works against either database
 * instead of crashing with ER_BAD_FIELD_ERROR.
 */
export interface ReviewColumns {
  /** column that holds the review body */
  text: string;
  /** column that holds the optional title, or null if the table has none */
  title: string | null;
  /** whether the `featured` flag column exists */
  featured: boolean;
}

let cached: Promise<ReviewColumns> | null = null;

async function detect(): Promise<ReviewColumns> {
  const rows = await query<RowDataPacket & { COLUMN_NAME: string }>(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'reviews'`
  );
  const cols = new Set(rows.map((r) => r.COLUMN_NAME.toLowerCase()));
  return {
    text: cols.has("content") ? "content" : "review_text",
    title: cols.has("review_title") ? "review_title" : null,
    featured: cols.has("featured"),
  };
}

/**
 * Root cause of "the reviews table has no `featured` column": the live database
 * was created from the original schema, which never had that column, while the
 * admin UI always sent it. Instead of failing on every edit, add the column
 * automatically the first time it is missing (needs ALTER privilege, which the
 * Hostinger DB user has). If ALTER is not allowed, `featured` stays false and the
 * UI hides the Featured option rather than erroring. Migration 010 does the same
 * thing by hand.
 */
async function load(): Promise<ReviewColumns> {
  let cols = await detect();
  if (!cols.featured) {
    try {
      await execute("ALTER TABLE reviews ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0");
      cols = await detect();
    } catch (err) {
      console.warn("[reviews] could not add `featured` column automatically:", (err as Error).message);
    }
  }
  return cols;
}

export function getReviewColumns(): Promise<ReviewColumns> {
  if (!cached) {
    cached = load().catch((err) => {
      cached = null; // don't cache a failed lookup
      throw err;
    });
  }
  return cached;
}
