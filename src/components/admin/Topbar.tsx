"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAdminBase } from "@/lib/use-admin-base";

export function Topbar({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  const adminBase = useAdminBase();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(`${adminBase}/login`);
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-background px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-foreground leading-tight">{name}</p>
          <p className="text-xs text-muted leading-tight">{role}</p>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-crimson-light text-sm font-bold text-crimson">
          {name.charAt(0).toUpperCase()}
        </div>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
