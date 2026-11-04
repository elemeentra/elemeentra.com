import { ImageResponse } from "next/og";
import { query, type RowDataPacket } from "@/lib/db";
import { PUBLISHED_SQL } from "@/lib/post-visibility";

export const alt = "Blog post";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Row extends RowDataPacket { title: string; author_name: string | null }

/** Generated social-share card for every published post (used when no OG image is set). */
export default async function PostOgImage({ params }: { params: { slug: string } }) {
  const rows = await query<Row>(
    `SELECT title, author_name FROM posts WHERE slug = ? AND ${PUBLISHED_SQL} LIMIT 1`,
    [params.slug]
  ).catch(() => [] as Row[]);
  const title = (rows[0]?.title ?? "Elemeentra Blog").slice(0, 110);
  const author = rows[0]?.author_name ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "64px", background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: "#c0392b", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 900 }}>E</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#111" }}>Elemeentra</div>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 70 ? 54 : 68, fontWeight: 900, lineHeight: 1.1, color: "#111" }}>{title}</div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#666" }}>
          <div>{author}</div>
          <div style={{ color: "#c0392b", fontWeight: 700 }}>WordPress · WooCommerce · Growth</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
