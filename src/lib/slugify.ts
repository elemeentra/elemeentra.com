import { query, type RowDataPacket } from "./db";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // strip punctuation
    .replace(/[\s_]+/g, "-") // spaces/underscores -> hyphen
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphen
}

interface SlugRow extends RowDataPacket {
  slug: string;
}

/**
 * Generates a unique slug for `table`, appending -2, -3, ... if needed.
 * `excludeId` lets an update skip colliding with its own current row.
 */
export async function generateUniqueSlug(
  table: "projects" | "posts" | "services" | "categories" | "tags",
  baseTitle: string,
  excludeId?: number
): Promise<string> {
  const base = slugify(baseTitle) || "item";
  let candidate = base;
  let suffix = 2;

  // Table name is from a fixed union type above (never user input), so this
  // is not a SQL-injection vector despite the string interpolation.
  const sql = excludeId
    ? `SELECT slug FROM ${table} WHERE slug = ? AND id != ? LIMIT 1`
    : `SELECT slug FROM ${table} WHERE slug = ? LIMIT 1`;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params = excludeId ? [candidate, excludeId] : [candidate];
    const rows = await query<SlugRow>(sql, params);
    if (rows.length === 0) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
