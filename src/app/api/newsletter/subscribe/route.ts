import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { execute } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(150),
  website: z.string().optional().default(""), // honeypot
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!checkRateLimit(`newsletter:${ip}`, 5, 10 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many attempts. Please try again later." }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid email." }, { status: 400 });
    }
    if (parsed.data.website) return NextResponse.json({ success: true });

    // New subscriber, or re-subscribe of someone who previously opted out.
    await execute(
      `INSERT INTO newsletter_subscribers (email, unsubscribe_token)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE unsubscribed_at = NULL`,
      [parsed.data.email, randomBytes(24).toString("hex")]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[newsletter]", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
