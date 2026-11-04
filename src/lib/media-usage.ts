import "server-only";
import { query, execute, type RowDataPacket } from "@/lib/db";
import { placeholders } from "@/lib/api-utils";
import { deleteImageFiles } from "@/lib/upload";
import { SETTING_LABELS, settingsPageFor } from "@/lib/settings-keys";

export interface MediaRef {
  id: number;
  file_url: string;
  thumbnail_url: string | null;
}

export interface MediaUsage {
  type: string; // e.g. "Blog post"
  title: string;
  field: string; // e.g. "Featured image"
  href: string; // relative to the admin base, e.g. "blog/12/edit"
}

interface Source {
  type: string;
  table: string;
  idColumn: string;
  titleColumn: string;
  columns: { name: string; label: string }[];
  href: (id: string | number) => string;
  /** Optional: turn the raw title column (e.g. a settings key) into something readable. */
  formatTitle?: (raw: string) => string;
}

/**
 * Every place a media URL can end up. Column names come from the live DB
 * dump — image URL columns AND rich-text/JSON columns, since the editor
 * embeds images inline and the portfolio gallery is stored as JSON.
 */
const SOURCES: Source[] = [
  {
    type: "Blog post",
    table: "posts",
    idColumn: "id",
    titleColumn: "title",
    columns: [
      { name: "featured_image", label: "Featured image" },
      { name: "og_image", label: "OG image" },
      { name: "content", label: "Post content" },
    ],
    href: (id) => `blog/${id}/edit`,
  },
  {
    type: "Portfolio project",
    table: "projects",
    idColumn: "id",
    titleColumn: "title",
    columns: [
      { name: "image_url", label: "Cover image" },
      { name: "gallery_images", label: "Gallery" },
      { name: "description", label: "Description" },
      { name: "challenge", label: "Challenge" },
      { name: "solution", label: "Solution" },
    ],
    href: (id) => `portfolio/${id}/edit`,
  },
  {
    type: "Service",
    table: "services",
    idColumn: "id",
    titleColumn: "title",
    columns: [{ name: "full_description", label: "Description" }],
    href: (id) => `services/${id}/edit`,
  },
  {
    type: "Team member",
    table: "team_members",
    idColumn: "id",
    titleColumn: "name",
    columns: [
      { name: "photo_url", label: "Photo" },
      { name: "bio", label: "Bio" },
    ],
    href: () => "team",
  },
  {
    type: "User",
    table: "users",
    idColumn: "id",
    titleColumn: "name",
    columns: [
      { name: "profile_photo", label: "Profile photo" },
      { name: "bio", label: "Bio" },
    ],
    href: () => "users",
  },
  {
    type: "Social link",
    table: "user_social_links",
    idColumn: "id",
    titleColumn: "platform_name",
    columns: [{ name: "custom_icon_url", label: "Custom icon" }],
    href: () => "users",
  },
  {
    type: "Setting",
    table: "settings",
    idColumn: "key_name",
    titleColumn: "key_name",
    columns: [{ name: "value", label: "Value" }],
    // id is the settings key: SEO keys live on their own admin page.
    href: (id) => settingsPageFor(String(id)),
    formatTitle: (raw) => SETTING_LABELS[raw] ?? raw,
  },
];

function asText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

/**
 * Finds where each media item is referenced. One query per source table
 * (not per media item): the DB narrows down candidate rows with LOCATE, then
 * we work out in JS exactly which file/column matched.
 */
export async function findMediaUsage(media: MediaRef[]): Promise<Map<number, MediaUsage[]>> {
  const result = new Map<number, MediaUsage[]>();
  media.forEach((m) => result.set(m.id, []));
  if (media.length === 0) return result;

  const needles: { mediaId: number; needle: string }[] = [];
  for (const m of media) {
    if (m.file_url) needles.push({ mediaId: m.id, needle: m.file_url });
    if (m.thumbnail_url) needles.push({ mediaId: m.id, needle: m.thumbnail_url });
  }

  await Promise.all(
    SOURCES.map(async (source) => {
      const where = source.columns
        .flatMap((c) => needles.map(() => `LOCATE(?, \`${c.name}\`) > 0`))
        .join(" OR ");
      const params = source.columns.flatMap(() => needles.map((n) => n.needle));
      const selectCols = source.columns.map((c) => `\`${c.name}\``).join(", ");

      const rows = await query<RowDataPacket>(
        `SELECT \`${source.idColumn}\` AS ref_id, \`${source.titleColumn}\` AS ref_title, ${selectCols}
         FROM \`${source.table}\`
         WHERE ${where}`,
        params
      );

      for (const row of rows) {
        for (const col of source.columns) {
          const text = asText(row[col.name]);
          if (!text) continue;
          for (const { mediaId, needle } of needles) {
            if (!text.includes(needle)) continue;
            const list = result.get(mediaId);
            if (!list) continue;
            const usage: MediaUsage = {
              type: source.type,
              title: source.formatTitle
                ? source.formatTitle(asText(row.ref_title))
                : asText(row.ref_title) || `#${asText(row.ref_id)}`,
              field: col.label,
              href: source.href(row.ref_id),
            };
            const dupe = list.some(
              (u) => u.type === usage.type && u.title === usage.title && u.field === usage.field
            );
            if (!dupe) list.push(usage);
          }
        }
      }
    })
  );

  return result;
}

interface MediaRow extends RowDataPacket {
  id: number;
  filename: string;
  file_url: string;
  thumbnail_url: string | null;
}

export type DeleteMediaResult =
  | { ok: true; deleted: number; fileErrors: number }
  | { ok: false; inUse: { id: number; filename: string; usages: MediaUsage[] }[] };

/**
 * Deletes media rows AND their files on disk. Unless `force` is set, nothing
 * is deleted when any selected file is still referenced somewhere — the caller
 * gets the usage list back so the UI can warn first.
 */
export async function deleteMedia(ids: number[], force: boolean): Promise<DeleteMediaResult> {
  const rows = await query<MediaRow>(
    `SELECT id, filename, file_url, thumbnail_url FROM media WHERE id IN (${placeholders(ids.length)})`,
    ids
  );
  if (rows.length === 0) return { ok: true, deleted: 0, fileErrors: 0 };

  if (!force) {
    const usage = await findMediaUsage(rows);
    const inUse = rows
      .filter((r) => (usage.get(r.id)?.length ?? 0) > 0)
      .map((r) => ({ id: r.id, filename: r.filename, usages: usage.get(r.id) ?? [] }));
    if (inUse.length > 0) return { ok: false, inUse };
  }

  // DB row first: if file removal fails afterwards we only leave an orphan
  // file on disk, never a library entry pointing at a missing file.
  const dbResult = await execute(
    `DELETE FROM media WHERE id IN (${placeholders(rows.length)})`,
    rows.map((r) => r.id)
  );

  const fileResults = await Promise.all(rows.map((r) => deleteImageFiles(r.file_url, r.thumbnail_url)));
  return {
    ok: true,
    deleted: dbResult.affectedRows,
    fileErrors: fileResults.filter((ok) => !ok).length,
  };
}
