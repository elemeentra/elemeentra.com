"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin top progress bar for client-side navigation. Starts instantly on any
 * internal link click (so the UI reacts before the server has answered) and
 * finishes when the URL changes. Dependency-free.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  function stop() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  function start() {
    stop();
    setVisible(true);
    setWidth(12);
    timer.current = setInterval(() => {
      setWidth((w) => (w < 85 ? w + (90 - w) * 0.12 : w));
    }, 200);
  }

  // Route changed → finish.
  useEffect(() => {
    stop();
    setWidth(100);
    const t = setTimeout(() => { setVisible(false); setWidth(0); }, 250);
    return () => clearTimeout(t);
  }, [pathname, search]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }
    document.addEventListener("click", onClick);
    return () => { document.removeEventListener("click", onClick); stop(); };
  }, []);

  if (!visible) return null;
  return (
    <div className="pointer-events-none fixed left-0 top-0 z-[100] h-0.5 w-full" role="progressbar" aria-hidden="true">
      <div className="h-full bg-crimson transition-[width] duration-200 ease-out" style={{ width: `${width}%` }} />
    </div>
  );
}
