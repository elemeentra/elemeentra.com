import { NextRequest, NextResponse } from "next/server";
import { recordPageView } from "@/lib/analytics";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

/**
 * POST /api/track
 * Lightweight, anonymous page-view tracker called from the public frontend.
 * Body: { path: string }
 * No auth required. Silently ignores errors so a DB hiccup never breaks the page.
 */
export async function POST(request: NextRequest) {
  try {
    // Basic abuse guard: max 60 hits / minute / IP (in-memory, per process).
    const ip = getClientIp(request.headers);
    if (!checkRateLimit(`track:${ip}`, 60, 60_000).allowed) {
      return NextResponse.json({ ok: false }, { status: 429 });
    }

    const body = await request.json().catch(() => ({})) as Record<string, unknown>;
    const path = typeof body.path === "string" ? body.path.slice(0, 500) : null;
    if (!path || !path.startsWith("/")) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    // Never count admin / API traffic as visitor page views.
    if (path.startsWith("/api") || path.startsWith("/admin")) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // Referrer: the client sends document.referrer in the body (the HTTP
    // Referer header of a same-origin fetch is always our own site, which
    // would make every referrer "elemeentra.com"). Store the domain only.
    let referrer: string | null = null;
    const rawRef = typeof body.referrer === "string" ? body.referrer : "";
    try {
      const host = new URL(rawRef).hostname.slice(0, 255);
      const own = request.nextUrl.hostname;
      if (host && host !== own) referrer = host;
    } catch { /* ignore */ }

    // Country from Cloudflare header (if present).
    const country_code = (request.headers.get("cf-ipcountry") ?? "").slice(0, 2) || null;

    // Device from User-Agent (coarse).
    const ua = (request.headers.get("user-agent") ?? "").toLowerCase();
    const device: "desktop" | "mobile" | "tablet" | "unknown" =
      /tablet|ipad/.test(ua) ? "tablet" :
      /mobile|android|iphone/.test(ua) ? "mobile" :
      ua ? "desktop" : "unknown";

    await recordPageView({ path, referrer, country_code, device });
    return NextResponse.json({ ok: true });
  } catch {
    // Never let a tracking error surface to the visitor.
    return NextResponse.json({ ok: false });
  }
}
