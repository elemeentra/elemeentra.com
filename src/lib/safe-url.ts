/** Returns the URL only if it is http(s) (or mailto/tel when allowed); otherwise null. Blocks javascript:/data: links. */
export function safeHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
