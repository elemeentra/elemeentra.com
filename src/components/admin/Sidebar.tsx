"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAdminBase } from "@/lib/use-admin-base";
import { warm } from "@/lib/admin-cache";
import { BrandLogo, type BrandProps } from "@/components/brand/BrandLogo";
import { NAV_GROUPS } from "@/components/admin/admin-nav";
import type { PermissionMap, PermissionModule } from "@/lib/permissions";

export function Sidebar({
  permissions,
  isSuperAdmin,
  brand,
}: {
  permissions: PermissionMap;
  isSuperAdmin: boolean;
  brand: BrandProps;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const adminBase = useAdminBase();

  const canSee = (mod: PermissionModule) => isSuperAdmin || (permissions[mod]?.length ?? 0) > 0;

  // One item is active at a time: the most specific match. Without this,
  // "Settings" (settings) would also light up on "SEO Settings" (settings/seo).
  const activeHref = NAV_GROUPS.flatMap((g) => g.items.map((i) => `${adminBase}/${i.href}`))
    .filter((h) => pathname === h || pathname.startsWith(`${h}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="adm-sidebar" aria-label="Admin navigation">
      <Link href={`${adminBase}/dashboard`} className="adm-brand" aria-label={`${brand.siteName} dashboard`}>
        {/* Logo + name come from Settings → General; "show text" off = logo only */}
        <BrandLogo
          siteName={`${brand.siteName} CMS`}
          logoUrl={brand.logoUrl}
          showText={brand.showText}
          size={42}
          priority
          textClassName="text-[15px] font-bold tracking-tight text-white"
          subtitle="Build · Manage · Grow"
          subtitleClassName="mt-0.5 text-[10px] tracking-[0.35px] text-[#b9aeb1]"
          textWrapClassName="adm-brand-text"
        />
      </Link>

      <nav>
        {NAV_GROUPS.map((group, i) => {
          const visibleItems = group.items.filter((item) => canSee(item.module));
          if (visibleItems.length === 0) return null;

          return (
            <div key={i} className="adm-nav-group">
              {group.heading && <div className="adm-nav-label">{group.heading}</div>}
              {visibleItems.map((item) => {
                const href = `${adminBase}/${item.href}`;
                const active = href === activeHref;
                const Icon = item.icon;
                // Hover/focus = intent to click: fetch the page's code and its list data now.
                const warmUp = () => {
                  router.prefetch(href);
                  if (item.warm) warm(`${item.warm}?page=1`);
                };
                return (
                  <Link
                    key={item.href}
                    href={href}
                    prefetch
                    title={item.label}
                    aria-current={active ? "page" : undefined}
                    onMouseEnter={warmUp}
                    onFocus={warmUp}
                    onTouchStart={warmUp}
                    className={`adm-nav-link${active ? " active" : ""}`}
                  >
                    <Icon aria-hidden />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="adm-sidebar-bottom">
        <p className="adm-security">
          Security by{" "}
          <a href="https://sigintrecon.com/" target="_blank" rel="noopener noreferrer">
            Sigintrecon
          </a>
        </p>
      </div>
    </aside>
  );
}
