"use client";

import { useEffect, useState } from "react";
import { BrandLogo, type BrandProps } from "@/components/brand/BrandLogo";

/**
 * Logo-animated loading screen. Shown once per browser session (not on every
 * navigation) and removed as soon as the page has loaded, so it never delays
 * real content for more than a moment.
 */
export function SplashScreen({ brand }: { brand: BrandProps }) {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("gone");

  useEffect(() => {
    try {
      if (sessionStorage.getItem("elem-splash")) return;
      sessionStorage.setItem("elem-splash", "1");
    } catch { /* storage blocked → just show it */ }
    setPhase("show");
    const fade = setTimeout(() => setPhase("fade"), 900);
    const gone = setTimeout(() => setPhase("gone"), 1300);
    return () => { clearTimeout(fade); clearTimeout(gone); };
  }, []);

  if (phase === "gone") return null;
  return (
    <div
      className={`fixed inset-0 z-[200] flex items-center justify-center bg-background transition-opacity duration-400 ${
        phase === "fade" ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="flex animate-pulse flex-col items-center gap-3">
        <BrandLogo {...brand} size={72} priority className="flex-col !gap-3 text-center" textClassName="text-lg font-black tracking-tight text-foreground" />
      </div>
    </div>
  );
}
