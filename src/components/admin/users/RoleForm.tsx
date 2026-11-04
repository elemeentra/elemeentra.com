"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { PERMISSION_ACTIONS, PERMISSION_MODULES, SUPER_ADMIN_ONLY } from "@/lib/permissions";
import { useAdminBase } from "@/lib/use-admin-base";

const MODULES = PERMISSION_MODULES.filter((m) => !SUPER_ADMIN_ONLY.includes(m));

const MODULE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  analytics: "Analytics",
  portfolio: "Portfolio",
  blog: "Blog",
  services: "Services",
  reviews: "Reviews",
  contacts: "Contacts",
  newsletter: "Newsletter",
  media: "Media Library",
  comments: "Comments",
  team: "Team",
};

interface RoleFormProps {
  mode: "create" | "edit";
  roleId?: number;
  initialName?: string;
  initialPermissions?: Record<string, string[]>;
  isSystemRole?: boolean;
}

export function RoleForm({ mode, roleId, initialName = "", initialPermissions = {}, isSystemRole }: RoleFormProps) {
  const router = useRouter();
  const adminBase = useAdminBase();
  const [name, setName] = useState(initialName);
  const [permissions, setPermissions] = useState<Record<string, string[]>>(initialPermissions);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const has = (module: string, action: string) => permissions[module]?.includes(action) ?? false;

  function toggle(module: string, action: string) {
    setPermissions((prev) => {
      const current = new Set(prev[module] ?? []);
      if (current.has(action)) {
        current.delete(action);
        // Removing "view" removes the whole row — nothing else works without it.
        if (action === "view") current.clear();
      } else {
        current.add(action);
        current.add("view");
      }
      const next = { ...prev };
      if (current.size === 0) delete next[module];
      else next[module] = PERMISSION_ACTIONS.filter((a) => current.has(a));
      return next;
    });
  }

  function toggleRow(module: string) {
    setPermissions((prev) => {
      const next = { ...prev };
      if ((prev[module]?.length ?? 0) === PERMISSION_ACTIONS.length) delete next[module];
      else next[module] = [...PERMISSION_ACTIONS];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(mode === "create" ? "/api/admin/roles" : `/api/admin/roles/${roleId}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const firstIssue = data.issues ? Object.values(data.issues as Record<string, string[]>).flat()[0] : null;
        setError(firstIssue ?? data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }
      router.push(`${adminBase}/users/roles`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">{error}</div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="mb-1.5 block text-sm font-medium text-foreground">
          Role name <span className="text-crimson">*</span>
        </label>
        <input
          required
          minLength={2}
          maxLength={50}
          value={name}
          disabled={isSystemRole}
          onChange={(e) => setName(e.target.value)}
          className="w-full max-w-md rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-crimson disabled:opacity-60"
        />
        {isSystemRole && <p className="mt-1 text-xs text-muted">System role names can&apos;t be changed.</p>}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-5 py-3">Module</th>
              {PERMISSION_ACTIONS.map((a) => (
                <th key={a} className="px-3 py-3 text-center">
                  {a}
                </th>
              ))}
              <th className="px-3 py-3 text-center">All</th>
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m} className="border-b border-border last:border-0 hover:bg-surface/60">
                <td className="px-5 py-2.5 font-medium text-foreground">{MODULE_LABELS[m] ?? m}</td>
                {PERMISSION_ACTIONS.map((a) => (
                  <td key={a} className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={has(m, a)}
                      onChange={() => toggle(m, a)}
                      aria-label={`${MODULE_LABELS[m] ?? m}: ${a}`}
                      className="h-4 w-4 rounded border-border accent-crimson"
                    />
                  </td>
                ))}
                <td className="px-3 py-2.5 text-center">
                  <input
                    type="checkbox"
                    checked={(permissions[m]?.length ?? 0) === PERMISSION_ACTIONS.length}
                    onChange={() => toggleRow(m)}
                    aria-label={`${MODULE_LABELS[m] ?? m}: all`}
                    className="h-4 w-4 rounded border-border accent-crimson"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Granting any action also grants “view”. Not every action applies to every module. Users &amp; Roles and Settings
        are reserved for Super Admin. Changes apply to signed-in users on their next request.
      </p>

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {mode === "create" ? "Create Role" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push(`${adminBase}/users/roles`)}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
