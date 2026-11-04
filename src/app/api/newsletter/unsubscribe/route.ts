import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { execute } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().regex(/^[a-f0-9]{16,128}$/i, "Invalid link.") });

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers);
    if (!checkRateLimit(`unsub:${ip}`, 10, 10 * 60_000).allowed) {
      return NextResponse.json({ error: "Too many attempts." }, { status: 429 });
    }
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Invalid link." }, { status: 400 });

    const res = await execute(
      "UPDATE newsletter_subscribers SET unsubscribed_at = NOW() WHERE unsubscribe_token = ? AND unsubscribed_at IS NULL",
      [parsed.data.token]
    );
    // Same answer whether or not the token matched: no subscriber enumeration.
    return NextResponse.json({ success: true, changed: res.affectedRows > 0 });
  } catch (err) {
    console.error("[newsletter/unsubscribe]", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
