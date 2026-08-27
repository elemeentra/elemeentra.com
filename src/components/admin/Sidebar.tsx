"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BarChart3,
  Newspaper,
  Briefcase,
  Layers,
  Star,
  Mail,
  MessageSquare,
  Send,
  Images,
  Users,
  UserSquare2,
  Settings,
  Search,
} from "lucide-react";
import { useAdminBase } from "@/lib/use-admin-base";
import type { PermissionMap, PermissionModule } from "@/lib/permissions";

interface NavItem {
  label: string;
  href: string; // relative to admin base, e.g. "dashboard"
  icon: React.ComponentType<{ className?: string }>;
  module: PermissionModule;
}

interface NavGroup {
  heading?: string;
  items: NavItem[];
}

// Order matches PRD §35 exactly.
const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "dashboard", icon: LayoutDashboard, module: "dashboard" },
      { label: "Analytics", href: "analytics", icon: BarChart3, module: "analytics" },
    ],
  },
  {
    heading: "Content",
    items: [
      { label: "Blog / Posts", href: "blog", icon: Newspaper, module: "blog" },
      { label: "Portfolio", href: "portfolio", icon: Briefcase, module: "portfolio" },
      { label: "Services", href: "services", icon: Layers, module: "services" },
      { label: "Reviews", href: "reviews", icon: Star, module: "reviews" },
    ],
  },
  {
    heading: "Engagement",
    items: [
      { label: "Contacts", href: "contacts", icon: Mail, module: "contacts" },
      { label: "Comments", href: "comments", icon: MessageSquare, module: "comments" },
      { label: "Newsletter", href: "newsletter", icon: Send, module: "newsletter" },
    ],
  },
  {
    heading: "Media",
    items: [{ label: "Media Library", href: "media", icon: Images, module: "media" }],
  },
  {
    heading: "People",
    items: [
      { label: "Users & Roles", href: "users", icon: Users, module: "users" },
      { label: "Team", href: "team", icon: UserSquare2, module: "team" },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Settings", href: "settings", icon: Settings, module: "settings" },
      { label: "SEO Settings", href: "settings/seo", icon: Search, module: "settings" },
    ],
  },
];

export function Sidebar({ permissions, isSuperAdmin }: { permissions: PermissionMap; isSuperAdmin: boolean }) {
  const pathname = usePathname();
  const adminBase = useAdminBase();

  const canSee = (mod: PermissionModule) => isSuperAdmin || (permissions[mod]?.length ?? 0) > 0;

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-crimson text-sm font-black text-white">
          E
        </div>
        <span className="text-sm font-bold tracking-tight text-foreground">Elemeentra CMS</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_GROUPS.map((group, i) => {
          const visibleItems = group.items.filter((item) => canSee(item.module));
          if (visibleItems.length === 0) return null;

          return (
            <div key={i} className="mb-4">
              {group.heading && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                  {group.heading}
                </p>
              )}
              <ul className="space-y-0.5">
                {visibleItems.map((item) => {
                  const href = `${adminBase}/${item.href}`;
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={href}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                          active
                            ? "bg-crimson-light text-crimson"
                            : "text-foreground/80 hover:bg-surface hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
