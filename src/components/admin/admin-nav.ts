import {
  LayoutDashboard, BarChart3, Newspaper, Briefcase, Layers, Star, Mail, MessageSquare,
  Send, Images, Users, UserSquare2, Settings, Search,
  type LucideIcon,
} from "lucide-react";
import type { PermissionModule } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string; // relative to admin base, e.g. "dashboard"
  icon: LucideIcon;
  module: PermissionModule;
  /** List endpoint to warm on hover so the page opens with data already there. */
  warm?: string;
}

export interface NavGroup {
  heading?: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { label: "Dashboard", href: "dashboard", icon: LayoutDashboard, module: "dashboard" },
      { label: "Analytics", href: "analytics", icon: BarChart3, module: "analytics" },
    ],
  },
  {
    heading: "Content",
    items: [
      { label: "Blog / Posts", href: "blog", icon: Newspaper, module: "blog", warm: "/api/admin/blog" },
      { label: "Portfolio", href: "portfolio", icon: Briefcase, module: "portfolio", warm: "/api/admin/portfolio" },
      { label: "Services", href: "services", icon: Layers, module: "services", warm: "/api/admin/services" },
      { label: "Reviews", href: "reviews", icon: Star, module: "reviews", warm: "/api/admin/reviews" },
    ],
  },
  {
    heading: "Engagement",
    items: [
      { label: "Contacts", href: "contacts", icon: Mail, module: "contacts", warm: "/api/admin/contacts" },
      { label: "Comments", href: "comments", icon: MessageSquare, module: "comments", warm: "/api/admin/comments" },
      { label: "Newsletter", href: "newsletter", icon: Send, module: "newsletter" },
    ],
  },
  {
    heading: "Media",
    items: [{ label: "Media Library", href: "media", icon: Images, module: "media", warm: "/api/admin/media" }],
  },
  {
    heading: "People",
    items: [
      { label: "Users & Roles", href: "users", icon: Users, module: "users", warm: "/api/admin/users" },
      { label: "Team", href: "team", icon: UserSquare2, module: "team", warm: "/api/admin/team" },
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

/** "Create" shortcuts offered by the top-bar search. */
export const CREATE_SHORTCUTS: { label: string; href: string; module: PermissionModule }[] = [
  { label: "New Blog Post", href: "blog/new", module: "blog" },
  { label: "Add Portfolio Project", href: "portfolio/new", module: "portfolio" },
  { label: "Add Service", href: "services/new", module: "services" },
  { label: "Add Team Member", href: "team/new", module: "team" },
  { label: "Add User", href: "users/new", module: "users" },
];
