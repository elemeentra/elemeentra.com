import "server-only";

/**
 * Verifies an hCaptcha token. Fully optional: when HCAPTCHA_SECRET is not set
 * (e.g. local dev) verification is skipped so forms keep working; once the
 * secret is configured, a missing or invalid token is rejected.
 */
export async function verifyHcaptcha(token: unknown): Promise<boolean> {
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return true;
  if (typeof token !== "string" || !token) return false;
  try {
    const res = await fetch("https://api.hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token }),
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
