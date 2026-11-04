"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Trash2, Zap, Loader2, Plus, Pencil, Unlock } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminList } from "@/components/admin/useAdminList";
import { PeopleTabs } from "@/components/admin/users/PeopleTabs";
import { formatDateTime } from "@/lib/date-utils";
import { useAdminBase } from "@/lib/use-admin-base";

interface UserItem {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  status: "active" | "inactive";
  profile_photo: string | null;
  last_login_at: string | null;
  locked: boolean;
  is_self: boolean;
}

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  locked: number;
}

interface RoleOption {
  id: number;
  name: string;
}

type BulkAction = "" | "activate" | "deactivate" | "unlock" | "delete";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function UsersList() {
  const adminBase = useAdminBase();
  const list = useAdminList<UserItem, UserStats>("/api/admin/users");
  const { items, stats, selected, setSelected } = list;

  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEdit, setQuickEdit] = useState<{ name: string; role_id: number; status: "active" | "inactive" }>({
    name: "",
    role_id: 0,
    status: "active",
  });
  const [quickEditSaving, setQuickEditSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/roles")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setRoles(data.items ?? []))
      .catch(() => setRoles([]));
  }, []);

  function openQuickEdit(u: UserItem) {
    setQuickEditId(u.id);
    setQuickEdit({ name: u.name, role_id: u.role_id, status: u.status });
  }

  async function saveQuickEdit(u: UserItem) {
    if (!quickEdit.name.trim()) {
      setError("Name can't be empty.");
      return;
    }
    setQuickEditSaving(true);
    setError(null);
    setNotice(null);
    try {
      // Only send what changed, so own-account guards don't trip on untouched fields.
      const body: Record<string, unknown> = {};
      if (quickEdit.name.trim() !== u.name) body.name = quickEdit.name.trim();
      if (quickEdit.role_id !== u.role_id) body.role_id = quickEdit.role_id;
      if (quickEdit.status !== u.status) body.status = quickEdit.status;
      if (Object.keys(body).length === 0) {
        setQuickEditId(null);
        return;
      }
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      setQuickEditId(null);
      list.reload();
    } finally {
      setQuickEditSaving(false);
    }
  }

  async function unlockUser(u: UserItem) {
    setError(null);
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ unlock: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to unlock.");
      return;
    }
    list.reload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        setDeleteTarget(null);
        return;
      }
      setDeleteTarget(null);
      list.reload();
    } finally {
      setDeleting(false);
    }
  }

  async function confirmBulkDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: JSON_HEADERS,
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete selected users.");
        setBulkDeleteConfirm(false);
        return;
      }
      setBulkDeleteConfirm(false);
      setSelected(new Set());
      setBulkAction("");
      list.reload();
    } finally {
      setDeleting(false);
    }
  }

  async function applyBulkAction() {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === "delete") {
      setBulkDeleteConfirm(true);
      return;
    }
    setError(null);
    setNotice(null);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ ids: Array.from(selected), action: bulkAction }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Bulk action failed.");
      return;
    }
    setNotice(`${data.updated} user${data.updated === 1 ? "" : "s"} updated.`);
    setSelected(new Set());
    setBulkAction("");
    list.reload();
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const shownError = error ?? list.loadError;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users &amp; Roles</h1>
          <p className="mt-1 text-sm text-muted">Manage who can sign in to the CMS and what they can do.</p>
          {stats && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border bg-card px-3 py-1 text-foreground">
                Users <strong>{stats.total}</strong>
              </span>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-foreground">
                Active <strong>{stats.active}</strong>
              </span>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-foreground">
                Inactive <strong>{stats.inactive}</strong>
              </span>
              {stats.locked > 0 && (
                <span className="rounded-full border border-crimson/30 bg-crimson-light px-3 py-1 text-crimson">
                  Locked <strong>{stats.locked}</strong>
                </span>
              )}
            </div>
          )}
        </div>
        <Link
          href={`${adminBase}/users/new`}
          className="flex items-center gap-1.5 rounded-lg bg-crimson px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover"
        >
          <Plus className="h-4 w-4" />
          Add User
        </Link>
      </div>

      <PeopleTabs active="users" />

      {shownError && (
        <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {shownError}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">{notice}</div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson"
            />
          </div>
          <select
            value={list.statusFilter}
            onChange={(e) => list.setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson"
          >
            <option value="">All users</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="locked">Locked</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value as BulkAction)}
            disabled={selected.size === 0}
            className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-crimson disabled:opacity-50"
          >
            <option value="">Bulk actions</option>
            <option value="activate">Activate</option>
            <option value="deactivate">Deactivate</option>
            <option value="unlock">Unlock</option>
            <option value="delete">Delete</option>
          </select>
          <button
            onClick={applyBulkAction}
            disabled={selected.size === 0 || !bulkAction}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            Apply
            {selected.size > 0 && <span className="text-muted">({selected.size})</span>}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {list.loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            {list.search || list.statusFilter ? "No users match your filters." : "No users yet."}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={list.toggleAll}
                    className="h-4 w-4 rounded border-border accent-crimson"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-2 py-3">User</th>
                <th className="px-5 py-3">Role</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last login</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <Fragment key={u.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => list.toggleOne(u.id)}
                        className="h-4 w-4 rounded border-border accent-crimson"
                        aria-label={`Select ${u.name}`}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-crimson-light">
                          {u.profile_photo ? (
                            <Image src={u.profile_photo} alt="" fill sizes="40px" className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-crimson">
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`${adminBase}/users/${u.id}/edit`}
                            className="block truncate font-medium text-foreground hover:text-crimson"
                          >
                            {u.name}
                            {u.is_self && <span className="ml-1.5 text-xs font-normal text-muted">(you)</span>}
                          </Link>
                          <span className="block truncate text-xs text-muted">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge tone={u.role_name === "Super Admin" ? "crimson" : "gray"}>{u.role_name}</StatusBadge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge tone={u.status === "active" ? "green" : "gray"}>
                          {u.status === "active" ? "Active" : "Inactive"}
                        </StatusBadge>
                        {u.locked && <StatusBadge tone="red">Locked</StatusBadge>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted">
                      {u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        {u.locked && (
                          <button
                            onClick={() => unlockUser(u)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                            title="Unlock account"
                          >
                            <Unlock className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => (quickEditId === u.id ? setQuickEditId(null) : openQuickEdit(u))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Quick Edit"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`${adminBase}/users/${u.id}/edit`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(u)}
                          disabled={u.is_self}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
                          title={u.is_self ? "You can't delete your own account" : "Delete"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {quickEditId === u.id && (
                    <tr className="border-b border-border bg-surface/70">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Name</label>
                            <input
                              value={quickEdit.name}
                              maxLength={100}
                              onChange={(e) => setQuickEdit((q) => ({ ...q, name: e.target.value }))}
                              className="w-56 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Role</label>
                            <select
                              value={quickEdit.role_id}
                              disabled={u.is_self}
                              onChange={(e) => setQuickEdit((q) => ({ ...q, role_id: Number(e.target.value) }))}
                              className="w-44 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson disabled:opacity-60"
                            >
                              {roles.length === 0 && <option value={u.role_id}>{u.role_name}</option>}
                              {roles.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Status</label>
                            <select
                              value={quickEdit.status}
                              disabled={u.is_self}
                              onChange={(e) =>
                                setQuickEdit((q) => ({ ...q, status: e.target.value as "active" | "inactive" }))
                              }
                              className="w-32 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson disabled:opacity-60"
                            >
                              <option value="active">Active</option>
                              <option value="inactive">Inactive</option>
                            </select>
                          </div>
                          <div className="flex gap-2 pb-0.5">
                            <button
                              onClick={() => saveQuickEdit(u)}
                              disabled={quickEditSaving}
                              className="flex items-center gap-1.5 rounded-lg bg-crimson px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60"
                            >
                              {quickEditSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                              Save
                            </button>
                            <button
                              onClick={() => setQuickEditId(null)}
                              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-foreground transition hover:bg-card"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                        {u.is_self && (
                          <p className="mt-2 text-xs text-muted">You can&apos;t change your own role or status.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Pagination pagination={list.pagination} onPage={list.setPage} />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this user?"
        message={`${deleteTarget?.name} will lose access immediately. Their posts stay, but are no longer linked to an account. This can't be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={`Delete ${selected.size} users?`}
        message="They will lose access immediately and their posts will no longer be linked to an account. This can't be undone."
        loading={deleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
}
