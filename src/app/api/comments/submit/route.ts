import { NextRequest, NextResponse } from "next/server";
import { PUBLISHED_SQL } from "@/lib/post-visibility";
import { z } from "zod";
import { execute, query, type RowDataPacket } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyHcaptcha } from "@/lib/hcaptcha";

const schema = z.object({
  slug: z.string().trim().min(1).max(255),
  name: z.string().trim().min(2, "Please enter your name").max(150),
  email: z.string().trim().email("Please enter a valid email").max(150),
  comment_text: z.string().trim().min(3, "Comment is too short").max(2000),
  website: z.string().optional().default(""),
  captcha: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!checkRateLimit(`comment:${ip}`, 5, 10 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many comments. Please try again later." }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
    }
    const d = parsed.data;
    if (d.website) return NextResponse.json({ success: true }); // honeypot
    if (!(await verifyHcaptcha(d.captcha))) {
      return NextResponse.json({ error: "Captcha verification failed. Please try again." }, { status: 400 });
    }
    const posts = await query<RowDataPacket & { id: number }>(
      `SELECT id FROM posts WHERE slug = ? AND ${PUBLISHED_SQL} LIMIT 1`, [d.slug]
    );
    if (!posts[0]) return NextResponse.json({ error: "Post not found." }, { status: 404 });

    await execute(
      "INSERT INTO comments (post_id, name, email, comment_text, approved) VALUES (?, ?, ?, ?, FALSE)",
      [posts[0].id, d.name, d.email, d.comment_text]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[comments/submit]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
