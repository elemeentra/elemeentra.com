import type { MetadataRoute } from "next";
import { PUBLISHED_SQL } from "@/lib/post-visibility";
import { query, type RowDataPacket } from "@/lib/db";

export const dynamic = "force-dynamic";

interface SlugRow extends RowDataPacket { slug: string; updated_at: string | null }

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const entries: MetadataRoute.Sitemap = ["", "/services", "/portfolio", "/reviews", "/blog", "/about", "/contact", "/privacy", "/terms"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: "weekly",
    priority: p === "" ? 1 : 0.7,
  }));

  const safe = (sql: string) => query<SlugRow>(sql).catch(() => [] as SlugRow[]);
  const [services, projects, posts] = await Promise.all([
    safe("SELECT slug, updated_at FROM services WHERE status = 'active'"),
    safe("SELECT slug, updated_at FROM projects"),
    safe(`SELECT slug, updated_at FROM posts WHERE ${PUBLISHED_SQL} AND robots_index = 1`),
  ]);

  const add = (rows: SlugRow[], prefix: string) =>
    rows.forEach((r) => entries.push({
      url: `${base}${prefix}/${r.slug}`,
      lastModified: r.updated_at ? new Date(r.updated_at.replace(" ", "T") + "Z") : undefined,
      priority: 0.6,
    }));
  add(services, "/services");
  add(projects, "/portfolio");
  add(posts, "/blog");
  return entries;
}
