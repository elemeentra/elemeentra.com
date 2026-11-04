import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { verifyHcaptcha } from "@/lib/hcaptcha";
import { getReviewColumns } from "@/lib/reviews-schema";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name").max(150),
  email: z.string().trim().email("Please enter a valid email").max(150),
  rating: z.coerce.number().int().min(1, "Please choose a rating").max(5, "Please choose a rating"),
  review_title: z.string().trim().max(255).optional().default(""),
  review_text: z.string().trim().min(10, "Review is too short").max(3000),
  website: z.string().optional().default(""),
  captcha: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!checkRateLimit(`review:${ip}`, 3, 30 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 });
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
    const col = await getReviewColumns();
    const cols = ["name", "email", "rating", col.text, "status"];
    const vals: unknown[] = [d.name, d.email, d.rating, d.review_text, "pending"];
    if (col.title) { cols.push(col.title); vals.push(d.review_title || null); }
    await execute(
      `INSERT INTO reviews (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
      vals
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[reviews/submit]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
