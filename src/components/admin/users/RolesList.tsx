"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PeopleTabs } from "@/components/admin/users/PeopleTabs";
import { useAdminBase } from "@/lib/use-admin-base";

interface RoleItem {
  id: number;
  name: string;
  is_system_role: boolean;
  permissions: Record<string, string[]>;
  user_count: number;
}

export function RolesList() {
  const adminBase = useAdminBase();
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/roles");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to load roles.");
        return;
      }
      setRoles(data.items ?? []);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/roles/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete role.");
      }
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  }

  function summary(role: RoleItem): string {
    if (role.name === "Super Admin") return "Full access to everything";
    const modules = Object.keys(role.permissions).length;
    const total = Object.values(role.permissions).reduce((n, a) => n + a.length, 0);
    return modules === 0 ? "No access" : `${modules} modules · ${total} permissions`;
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users &amp; Roles</h1>
          <p className="mt-1 text-sm text-muted">Control what each role is allowed to do.</p>
        </div>
        <Link
          href={`${adminBase}/users/roles/new`}
          className="flex items-center gap-1.5 rounded-lg bg-crimson px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover"
        >
          <Plus className="h-4 w-4" />
          Add Role
        </Link>
      </div>

      <PeopleTabs active="roles" />

      {error && (
        <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading…</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Access</th>
                <th className="px-5 py-3">Users</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((r) => {
                const locked = r.name === "Super Admin";
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{r.name}</span>
                        {r.is_system_role && <StatusBadge tone="gray">System</StatusBadge>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">{summary(r)}</td>
                    <td className="px-5 py-3 text-foreground">{r.user_count}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        {locked ? (
                          <span
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted"
                            title="Super Admin can't be edited"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        ) : (
                          <Link
                            href={`${adminBase}/users/roles/${r.id}/edit`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                            title="Edit permissions"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        {!r.is_system_role && (
                          <button
                            onClick={() => setDeleteTarget(r)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                            title="Delete role"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this role?"
        message={`The "${deleteTarget?.name}" role will be removed. Roles that still have users assigned can't be deleted.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
