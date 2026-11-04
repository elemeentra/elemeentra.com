"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, ChevronDown, LogOut, Search, UserCircle2, ExternalLink, CornerDownLeft } from "lucide-react";
import { useAdminBase } from "@/lib/use-admin-base";
import { CREATE_SHORTCUTS, NAV_GROUPS } from "@/components/admin/admin-nav";
import { hasPermission, type PermissionMap } from "@/lib/permissions";

interface Props {
  name: string;
  role: string;
  /** users.profile_photo — shown in the corner avatar. */
  photo: string | null;
  userId: number | null;
  permissions: PermissionMap;
  isSuperAdmin: boolean;
}

interface Notice {
  key: string;
  label: string;
  count: number;
  href: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/** Closes a popover on outside click / Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

export function Topbar({ name, role, photo, userId, permissions, isSuperAdmin }: Props) {
  const router = useRouter();
  const adminBase = useAdminBase();

  /* ---------------- search (jump to any page / create something) ---------------- */
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const closeSearch = useCallback(() => setSearchOpen(false), []);
  const searchRef = useDismiss(searchOpen, closeSearch);

  const entries = useMemo(() => {
    const canSee = (mod: Parameters<typeof hasPermission>[2]) => isSuperAdmin || (permissions[mod]?.length ?? 0) > 0;
    const pages = NAV_GROUPS.flatMap((g) =>
      g.items.filter((i) => canSee(i.module)).map((i) => ({ label: i.label, href: i.href, group: g.heading ?? "Overview", icon: i.icon }))
    );
    const creates = CREATE_SHORTCUTS.filter((c) => hasPermission(permissions, isSuperAdmin, c.module, "create")).map((c) => ({
      label: c.label,
      href: c.href,
      group: "Create",
      icon: NAV_GROUPS[0].items[0].icon,
    }));
    return [...pages, ...creates];
  }, [permissions, isSuperAdmin]);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (term ? entries.filter((e) => e.label.toLowerCase().includes(term) || e.group.toLowerCase().includes(term)) : entries).slice(0, 8);
  }, [q, entries]);

  const go = useCallback(
    (href: string) => {
      setSearchOpen(false);
      setQ("");
      inputRef.current?.blur();
      router.push(`${adminBase}/${href}`);
    },
    [router, adminBase]
  );

  // Ctrl/Cmd + K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- notifications ---------------- */
  const [notices, setNotices] = useState<Notice[]>([]);
  const [total, setTotal] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);
  const closeBell = useCallback(() => setBellOpen(false), []);
  const bellRef = useDismiss(bellOpen, closeBell);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/admin/notifications");
        if (!res.ok || stop) return;
        const data = await res.json();
        setNotices(data.items ?? []);
        setTotal(Number(data.total ?? 0));
      } catch {
        /* offline — keep last counts */
      }
    };
    // Don't compete with the page's own data on first paint.
    const first = setTimeout(load, 1200);
    const timer = setInterval(load, 60_000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  /* ---------------- profile ---------------- */
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const menuRef = useDismiss(menuOpen, closeMenu);
  const [photoFailed, setPhotoFailed] = useState(false);
  useEffect(() => setPhotoFailed(false), [photo]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`${adminBase}/login`);
    router.refresh();
  }

  const canEditSelf = userId !== null && (isSuperAdmin || (permissions.users?.length ?? 0) > 0);

  return (
    <header className="adm-topbar">
      <div className="adm-search-wrap" ref={searchRef}>
        <div className="adm-search">
          <Search aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={q}
            placeholder="Search pages or actions… (Ctrl + K)"
            aria-label="Search dashboard"
            autoComplete="off"
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setCursor(0);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(results.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter" && results[cursor]) {
                e.preventDefault();
                go(results[cursor].href);
              } else if (e.key === "Escape") {
                setSearchOpen(false);
                inputRef.current?.blur();
              }
            }}
          />
          <kbd>Ctrl K</kbd>
        </div>
        {searchOpen && (
          <div className="adm-pop" role="listbox">
            {results.length === 0 ? (
              <p className="adm-pop-empty">Nothing matches “{q}”.</p>
            ) : (
              results.map((r, i) => {
                const Icon = r.icon;
                return (
                  <button
                    key={`${r.group}-${r.href}`}
                    type="button"
                    role="option"
                    aria-selected={i === cursor}
                    className={`adm-pop-item${i === cursor ? " on" : ""}`}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(r.href)}
                  >
                    <Icon aria-hidden />
                    {r.label}
                    <small>{i === cursor ? <CornerDownLeft size={12} /> : r.group}</small>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="adm-top-actions">
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            className="adm-icon-btn"
            aria-label={total > 0 ? `Notifications (${total})` : "Notifications"}
            aria-expanded={bellOpen}
            onClick={() => setBellOpen((o) => !o)}
          >
            <Bell aria-hidden />
            {total > 0 && <span className="adm-notif-count">{total > 99 ? "99+" : total}</span>}
          </button>
          {bellOpen && (
            <div className="adm-menu" style={{ minWidth: 270 }}>
              <div className="adm-menu-head">
                <strong>Needs attention</strong>
                <small>{total > 0 ? `${total} item${total === 1 ? "" : "s"}` : "You're all caught up"}</small>
              </div>
              {notices.map((n) => (
                <Link key={n.key} href={`${adminBase}/${n.href}`} className="adm-menu-item" onClick={closeBell}>
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--adm-red)] px-1.5 text-[11px] font-bold text-white">
                    {n.count}
                  </span>
                  {n.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="adm-top-divider" />

        <div className="relative" ref={menuRef}>
          <button type="button" className="adm-profile" aria-expanded={menuOpen} aria-haspopup="menu" onClick={() => setMenuOpen((o) => !o)}>
            <span className="adm-avatar">
              {photo && !photoFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt="" onError={() => setPhotoFailed(true)} />
              ) : (
                initials(name)
              )}
            </span>
            <span className="adm-profile-copy">
              <strong>{name}</strong>
              <small>{role}</small>
            </span>
            <ChevronDown aria-hidden />
          </button>
          {menuOpen && (
            <div className="adm-menu" role="menu">
              <div className="adm-menu-head">
                <strong>{name}</strong>
                <small>{role}</small>
              </div>
              {canEditSelf && (
                <Link role="menuitem" href={`${adminBase}/users/${userId}/edit`} className="adm-menu-item" onClick={closeMenu}>
                  <UserCircle2 aria-hidden /> My profile &amp; photo
                </Link>
              )}
              <a role="menuitem" href="/" target="_blank" rel="noopener noreferrer" className="adm-menu-item" onClick={closeMenu}>
                <ExternalLink aria-hidden /> View website
              </a>
              <button role="menuitem" type="button" className="adm-menu-item" onClick={handleLogout}>
                <LogOut aria-hidden /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
