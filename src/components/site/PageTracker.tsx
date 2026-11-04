"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fires one anonymous POST /api/track per client-side navigation.
 * No cookies, no PII. Failures are swallowed so tracking never affects UX.
 */
export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const body = JSON.stringify({ path: pathname, referrer: document.referrer });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  }, [pathname]);

  return null;
}
