"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    hcaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
    };
  }
}

const SITEKEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITEKEY;

/** Renders the hCaptcha widget only when NEXT_PUBLIC_HCAPTCHA_SITEKEY is set. */
export function HCaptcha({ onToken, resetKey = 0 }: { onToken: (t: string) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!SITEKEY || !box.current) return;
    const el = box.current;
    const mount = () => {
      if (!window.hcaptcha || widget.current !== null) return;
      widget.current = window.hcaptcha.render(el, {
        sitekey: SITEKEY,
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(""),
      });
    };
    if (window.hcaptcha) { mount(); return; }
    let script = document.querySelector<HTMLScriptElement>("script[data-hcaptcha]");
    if (!script) {
      script = document.createElement("script");
      script.src = "https://js.hcaptcha.com/1/api.js?render=explicit";
      script.async = true;
      script.dataset.hcaptcha = "1";
      document.head.appendChild(script);
    }
    script.addEventListener("load", mount);
    return () => script?.removeEventListener("load", mount);
  }, [onToken]);

  useEffect(() => {
    if (resetKey && widget.current !== null) { window.hcaptcha?.reset(widget.current); onToken(""); }
  }, [resetKey, onToken]);

  if (!SITEKEY) return null;
  return <div ref={box} className="min-h-[78px]" />;
}

export const captchaEnabled = Boolean(SITEKEY);
