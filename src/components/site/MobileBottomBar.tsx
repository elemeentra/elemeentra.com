"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Layers, Briefcase, Newspaper, Mail } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/services", label: "Services", icon: Layers },
  { href: "/portfolio", label: "Work", icon: Briefcase },
  { href: "/blog", label: "Blog", icon: Newspaper },
  { href: "/contact", label: "Contact", icon: Mail },
];

/** Bottom app-bar navigation for phones and tablets (hidden on desktop). */
export function MobileBottomBar() {
  const pathname = usePathname();
  const active = (h: string) => (h === "/" ? pathname === "/" : pathname.startsWith(h));
  return (
    <nav
      aria-label="App navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-xl items-stretch justify-around">
        {ITEMS.map(({ href, label, icon: Icon }) => (
          <li key={href} className="flex-1">
            <Link href={href} aria-current={active(href) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${active(href) ? "text-crimson" : "text-muted"}`}>
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
