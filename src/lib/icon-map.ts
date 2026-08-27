import {
  Rocket, Code2, ShoppingCart, PenTool, Search, Shield, Zap, Smartphone,
  Gauge, Wrench, Globe, LayoutTemplate, Server, Lock, TrendingUp, Palette,
  Layers, Megaphone, BarChart3, Mail, MessageCircle, Camera, Video, Music,
  FileText, Database, Cloud, Cpu, Settings, Users, Heart, Star, Award,
  Target, Briefcase, CreditCard, ShieldCheck, Sparkles, Compass, Package,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * A curated, explicitly-imported set of icons for the Services module.
 * Deliberately NOT `import * as Icons from "lucide-react"` — a wildcard
 * import combined with dynamic `Icons[name]` lookup defeats tree-shaking
 * and bundles the entire icon library (2000+ icons) into the client
 * bundle. Named imports keep only what's actually used.
 */
export const ICON_MAP: Record<string, LucideIcon> = {
  Rocket, Code2, ShoppingCart, PenTool, Search, Shield, Zap, Smartphone,
  Gauge, Wrench, Globe, LayoutTemplate, Server, Lock, TrendingUp, Palette,
  Layers, Megaphone, BarChart3, Mail, MessageCircle, Camera, Video, Music,
  FileText, Database, Cloud, Cpu, Settings, Users, Heart, Star, Award,
  Target, Briefcase, CreditCard, ShieldCheck, Sparkles, Compass, Package,
};

export const ICON_NAMES = Object.keys(ICON_MAP).sort();

export function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return HelpCircle;
  return ICON_MAP[name.trim()] ?? HelpCircle;
}

export { HelpCircle as FallbackIcon };
