import "server-only";
import { query, type RowDataPacket } from "@/lib/db";

/**
 * Detects which optional columns from migration 009 exist, so the blog keeps
 * working (just without those fields) if the migration hasn't been run yet.
 */
export interface BlogColumns {
  ogTitle: boolean;
  ogDescription: boolean;
  readTime: boolean;
  commentParent: boolean;
  commentStatus: boolean;
  contactTrash: boolean;
  contactReply: boolean;
}

let cached: Promise<BlogColumns> | null = null;

export function getBlogColumns(): Promise<BlogColumns> {
  if (!cached) {
    cached = query<RowDataPacket & { t: string; c: string }>(
      `SELECT TABLE_NAME AS t, COLUMN_NAME AS c FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('posts', 'comments', 'contact_messages')`
    )
      .then((rows) => {
        const has = (t: string, c: string) => rows.some((r) => r.t === t && r.c === c);
        return {
          ogTitle: has("posts", "og_title"),
          ogDescription: has("posts", "og_description"),
          readTime: has("posts", "read_time"),
          commentParent: has("comments", "parent_id"),
          commentStatus: has("comments", "moderation_status"),
          contactTrash: has("contact_messages", "is_trashed"),
          contactReply: has("contact_messages", "reply_message"),
        };
      })
      .catch((err) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}

/** Reading time in minutes (200 wpm, minimum 1) from HTML content. */
export function computeReadTime(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(1, Math.round(words / 200));
}

/** SQL condition that hides trashed contact messages (a no-op before migration 009). */
export async function contactVisibleSql(): Promise<string> {
  try {
    return (await getBlogColumns()).contactTrash ? "is_trashed = 0" : "1 = 1";
  } catch {
    return "1 = 1";
  }
}
