import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/jwt";
import { getEnv } from "@/lib/env";

/**
 * Admin panel URL security (PRD §30)
 * -----------------------------------
 * The admin UI physically lives at /admin/** in the codebase (see
 * src/app/(admin)/admin/**), but that path is never served publicly:
 *
 *   - A request to the literal /admin path returns a plain 404 — it does
 *     NOT redirect to a login page, because a redirect would confirm the
 *     panel exists.
 *   - The real entry point is `process.env.ADMIN_PATH`, a random secret
 *     segment (e.g. /elemeentra-cms-x7k2m9pq) configured per environment.
 *     Requests under that path are rewritten internally to /admin/*.
 *   - Unauthenticated requests to any admin page other than the login
 *     page are redirected to the (secret-prefixed) login page.
 */

function applySecurityHeaders(response: NextResponse): NextResponse {
  // OWASP A05 — Security Misconfiguration: baseline hardening headers.
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://hcaptcha.com https://*.hcaptcha.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "frame-src https://hcaptcha.com https://*.hcaptcha.com",
      "connect-src 'self' https://hcaptcha.com https://*.hcaptcha.com",
    ].join("; ")
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload"
    );
  }
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. The literal /admin path never resolves — this is what a scanner or
  //    curious visitor hits. Plain 404, no hint that a panel exists here.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return applySecurityHeaders(new NextResponse(null, { status: 404 }));
  }

  const adminPath = process.env.ADMIN_PATH;
  const isAdminRequest =
    !!adminPath && (pathname === `/${adminPath}` || pathname.startsWith(`/${adminPath}/`));

  if (!isAdminRequest) {
    return applySecurityHeaders(NextResponse.next());
  }

  // Map the secret public path back to the internal /admin/* route group.
  const rest = pathname.slice(`/${adminPath}`.length); // '' | '/login' | '/dashboard' ...
  const internalPath = rest === "" || rest === "/" ? "/admin/dashboard" : `/admin${rest}`;
  const isLoginPage = internalPath === "/admin/login";

  const env = getEnv();
  const token = request.cookies.get(env.COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!isLoginPage && !session) {
    const loginUrl = new URL(`/${adminPath}/login`, request.url);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  if (isLoginPage && session) {
    const dashboardUrl = new URL(`/${adminPath}/dashboard`, request.url);
    return applySecurityHeaders(NextResponse.redirect(dashboardUrl));
  }

  const rewritten = NextResponse.rewrite(new URL(internalPath, request.url));
  return applySecurityHeaders(rewritten);
}

export const config = {
  matcher: [
    /*
     * Run on everything except:
     *  - Next.js internals (_next/static, _next/image)
     *  - common static files (favicon, images, fonts)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|gif|woff2?)$).*)",
  ],
};
