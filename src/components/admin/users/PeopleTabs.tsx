"use client";

import Link from "next/link";
import { useAdminBase } from "@/lib/use-admin-base";

export function PeopleTabs({ active }: { active: "users" | "roles" }) {
  const adminBase = useAdminBase();
  const tab = (key: "users" | "roles", href: string, label: string) => (
    <Link
      href={href}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
        active === key
          ? "border-crimson text-crimson"
          : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="mb-6 flex gap-1 border-b border-border">
      {tab("users", `${adminBase}/users`, "Users")}
      {tab("roles", `${adminBase}/users/roles`, "Roles & Permissions")}
    </div>
  );
}
