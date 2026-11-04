"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { BrandLogo, type BrandProps } from "@/components/brand/BrandLogo";

interface NavService { title: string; slug: string; short_description: string | null }

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/reviews", label: "Reviews" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Navbar({ brand, services }: { brand: BrandProps; services: NavService[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mega, setMega] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  useEffect(() => { setMega(false); setOpen(false); }, [pathname]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMega(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const openMega = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setMega(true); };
  const closeMega = () => { closeTimer.current = setTimeout(() => setMega(false), 120); };
  const linkCls = (on: boolean) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition ${on ? "text-crimson" : "text-muted hover:text-foreground"}`;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" aria-label={brand.siteName} className="flex items-center text-foreground">
          <BrandLogo {...brand} size={38} priority textClassName="text-lg font-black tracking-tight text-foreground" />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          <Link href="/" className={linkCls(isActive("/"))}>Home</Link>

          {/* Services mega menu */}
          <div className="relative" onMouseEnter={openMega} onMouseLeave={closeMega}>
            <button
              type="button" aria-expanded={mega} aria-haspopup="true"
              onClick={() => setMega((m) => !m)} onFocus={openMega}
              className={`flex items-center gap-1 ${linkCls(isActive("/services"))}`}
            >
              Services <ChevronDown className={`h-3.5 w-3.5 transition ${mega ? "rotate-180" : ""}`} />
            </button>
            {mega && (
              <div className="absolute left-1/2 top-full w-[34rem] -translate-x-1/2 pt-2">
                <div className="rounded-2xl border border-border bg-background p-3 shadow-xl">
                  <div className="grid grid-cols-2 gap-1">
                    {services.slice(0, 8).map((s) => (
                      <Link key={s.slug} href={`/services/${s.slug}`} className="rounded-xl p-3 transition hover:bg-crimson-light">
                        <p className="text-sm font-semibold text-foreground">{s.title}</p>
                        {s.short_description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{s.short_description}</p>}
                      </Link>
                    ))}
                  </div>
                  <Link href="/services" className="mt-2 block rounded-xl bg-surface px-3 py-2 text-center text-xs font-semibold text-crimson hover:bg-crimson-light">
                    View all services →
                  </Link>
                </div>
              </div>
            )}
          </div>

          {LINKS.slice(1).map((l) => (
            <Link key={l.href} href={l.href} className={linkCls(isActive(l.href))}>{l.label}</Link>
          ))}
          <Link href="/contact" className="ml-2 rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover">
            Get a Quote
          </Link>
        </nav>

        <button className="rounded-lg p-2 text-foreground lg:hidden" onClick={() => setOpen((o) => !o)}
          aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="max-h-[70vh] overflow-y-auto border-t border-border bg-background px-6 py-3 lg:hidden" aria-label="Mobile">
          {[{ href: "/", label: "Home" }, { href: "/services", label: "Services" }, ...LINKS.slice(1)].map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className={`block rounded-lg px-3 py-2.5 text-sm font-medium ${isActive(l.href) ? "bg-crimson-light text-crimson" : "text-foreground"}`}>
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
