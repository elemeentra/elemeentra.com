/**
 * A post is publicly visible when it is published (or scheduled and its time
 * has come) AND its publish date has been reached. Without this, a post
 * saved as "published" with no date, or a "scheduled" post, never showed up on
 * the public site. Safe to inline in SQL (a constant, no user input). The DB
 * connection runs in UTC (see db.ts), so UTC_TIMESTAMP() matches stored values.
 */
export const PUBLISHED_SQL =
  "(status IN ('published', 'scheduled') AND published_at IS NOT NULL AND published_at <= UTC_TIMESTAMP())";

/** Same rule for a query that aliases the posts table (e.g. `FROM posts p` → publishedSqlFor("p")). */
export const publishedSqlFor = (alias: string) =>
  `(${alias}.status IN ('published', 'scheduled') AND ${alias}.published_at IS NOT NULL AND ${alias}.published_at <= UTC_TIMESTAMP())`;

/** Formats a Date/ISO string as a UTC `YYYY-MM-DD HH:MM:SS` MySQL DATETIME literal. */
export function toMysqlUtc(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toISOString().slice(0, 19).replace("T", " ");
}
