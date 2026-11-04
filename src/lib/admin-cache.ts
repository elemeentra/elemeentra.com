"use client";

/**
 * Tiny client-side data cache for the admin panel (stale-while-revalidate).
 *
 * Why: every list page used to mount, THEN download its data, and some mounted
 * twice (a debounced-search effect and a page effect both fired on first render,
 * so each page open sent two identical requests). Each request is a round-trip
 * to the remote database, so opening a section meant staring at "Loading…".
 *
 *  • getJson()  — de-duplicates in-flight requests and skips a re-fetch of data
 *                 that arrived < 3s ago (kills the double-load).
 *  • peek()     — lets a page paint the last-seen data instantly, then refresh it.
 *  • warm()     — the sidebar calls this on hover so data is already there on click.
 *  • Any write (POST/PATCH/PUT/DELETE) to /api/admin/* clears the cache, so a list
 *    never shows stale rows after you change something.
 */

interface Entry {
  at: number;
  data: unknown;
}
export interface JsonResult {
  ok: boolean;
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

const FRESH_MS = 3_000;
const STALE_MS = 5 * 60_000;
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<JsonResult>>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function peek(url: string): any | undefined {
  const e = cache.get(url);
  return e && Date.now() - e.at < STALE_MS ? e.data : undefined;
}

export function clearAdminCache(): void {
  cache.clear();
}

export function getJson(url: string): Promise<JsonResult> {
  const e = cache.get(url);
  if (e && Date.now() - e.at < FRESH_MS) return Promise.resolve({ ok: true, status: 200, data: e.data });

  const pending = inflight.get(url);
  if (pending) return pending;

  const p = fetch(url)
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (res.ok) cache.set(url, { at: Date.now(), data });
      return { ok: res.ok, status: res.status, data } as JsonResult;
    })
    .finally(() => inflight.delete(url));
  inflight.set(url, p);
  return p;
}

/** Fire-and-forget prefetch (hover / focus on a sidebar link). */
export function warm(url: string): void {
  if (peek(url) !== undefined && cache.get(url) && Date.now() - (cache.get(url) as Entry).at < FRESH_MS) return;
  void getJson(url).catch(() => undefined);
}

let installed = false;
/** Clear the cache whenever the admin writes anything. Safe to call many times. */
export function installMutationInvalidation(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const isWrite = method !== "GET" && method !== "HEAD" && url.includes("/api/admin/");
    if (isWrite) clearAdminCache();
    const p = original(input, init);
    if (isWrite) void p.finally(clearAdminCache).catch(() => undefined);
    return p;
  };
}
