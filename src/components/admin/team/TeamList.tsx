"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, Trash2, Zap, Loader2, Plus, Pencil, ArrowUp, ArrowDown } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminList } from "@/components/admin/useAdminList";
import { useAdminBase } from "@/lib/use-admin-base";

interface TeamItem {
  id: number;
  user_id: number | null;
  name: string;
  role: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  display_order: number;
  user_name: string | null;
}

interface TeamStats {
  total: number;
  linked: number;
}

type BulkAction = "" | "delete";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function TeamList() {
  const adminBase = useAdminBase();
  const list = useAdminList<TeamItem, TeamStats>("/api/admin/team");
  const { items, stats, selected, setSelected } = list;

  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<TeamItem | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEdit, setQuickEdit] = useState({ name: "", role: "", display_order: 0 });
  const [quickEditSaving, setQuickEditSaving] = useState(false);

  const [movingId, setMovingId] = useState<number | null>(null);

  // Moving only makes sense when the list is the real, unfiltered order.
  const canReorder = !list.search && !list.statusFilter;

  function openQuickEdit(m: TeamItem) {
    setQuickEditId(m.id);
    setQuickEdit({ name: m.name, role: m.role ?? "", display_order: m.display_order });
  }

  async function saveQuickEdit(id: number) {
    if (!quickEdit.name.trim()) {
      setError("Name can't be empty.");
      return;
    }
    setQuickEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          name: quickEdit.name.trim(),
          role: quickEdit.role.trim(),
          display_order: quickEdit.display_order,
        }),
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

  async function move(id: number, direction: "up" | "down") {
    setMovingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team/${id}/move`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ direction }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to reorder.");
        return;
      }
      list.reload();
    } finally {
      setMovingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/team/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
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
      const res = await fetch("/api/admin/team", {
        method: "DELETE",
        headers: JSON_HEADERS,
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete selected members.");
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

  function applyBulkAction() {
    if (bulkAction === "delete" && selected.size > 0) setBulkDeleteConfirm(true);
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const shownError = error ?? list.loadError;
  const firstId = items[0]?.id;
  const isFirstPage = (list.pagination?.page ?? 1) === 1;
  const isLastPage = (list.pagination?.page ?? 1) >= (list.pagination?.totalPages ?? 1);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team</h1>
          <p className="mt-1 text-sm text-muted">The people shown on your public team section.</p>
          {stats && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border bg-card px-3 py-1 text-foreground">
                Members <strong>{stats.total}</strong>
              </span>
              <span className="rounded-full border border-crimson/30 bg-crimson-light px-3 py-1 text-crimson">
                Linked to a user <strong>{stats.linked}</strong>
              </span>
            </div>
          )}
        </div>
        <Link
          href={`${adminBase}/team/new`}
          className="flex items-center gap-1.5 rounded-lg bg-crimson px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover"
        >
          <Plus className="h-4 w-4" />
          Add Member
        </Link>
      </div>

      {shownError && (
        <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {shownError}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              placeholder="Search by name or role…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson"
            />
          </div>
          <select
            value={list.statusFilter}
            onChange={(e) => list.setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson"
          >
            <option value="">All members</option>
            <option value="linked">Linked to a user</option>
            <option value="unlinked">Not linked</option>
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

      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {list.loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            {list.search || list.statusFilter ? "No team members match your filters." : "No team members yet."}
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
                <th className="px-2 py-3">Member</th>
                <th className="px-5 py-3">CMS user</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((m, index) => (
                <Fragment key={m.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => list.toggleOne(m.id)}
                        className="h-4 w-4 rounded border-border accent-crimson"
                        aria-label={`Select ${m.name}`}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border bg-crimson-light">
                          {m.photo_url ? (
                            <Image src={m.photo_url} alt="" fill sizes="40px" className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-crimson">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`${adminBase}/team/${m.id}/edit`}
                            className="block truncate font-medium text-foreground hover:text-crimson"
                          >
                            {m.name}
                          </Link>
                          <span className="block truncate text-xs text-muted">{m.role || "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {m.user_name ? <StatusBadge tone="green">{m.user_name}</StatusBadge> : <StatusBadge tone="gray">Not linked</StatusBadge>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-6 text-xs text-muted">{m.display_order}</span>
                        <button
                          onClick={() => move(m.id, "up")}
                          disabled={!canReorder || movingId !== null || (isFirstPage && m.id === firstId)}
                          title={canReorder ? "Move up" : "Clear search/filter to reorder"}
                          aria-label={`Move ${m.name} up`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => move(m.id, "down")}
                          disabled={!canReorder || movingId !== null || (isLastPage && index === items.length - 1)}
                          title={canReorder ? "Move down" : "Clear search/filter to reorder"}
                          aria-label={`Move ${m.name} down`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => (quickEditId === m.id ? setQuickEditId(null) : openQuickEdit(m))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Quick Edit"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`${adminBase}/team/${m.id}/edit`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {quickEditId === m.id && (
                    <tr className="border-b border-border bg-surface/70">
                      <td colSpan={5} className="px-5 py-4">
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
                            <input
                              value={quickEdit.role}
                              maxLength={100}
                              onChange={(e) => setQuickEdit((q) => ({ ...q, role: e.target.value }))}
                              className="w-56 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Order</label>
                            <input
                              type="number"
                              min={0}
                              value={quickEdit.display_order}
                              onChange={(e) => setQuickEdit((q) => ({ ...q, display_order: Number(e.target.value) }))}
                              className="w-24 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson"
                            />
                          </div>
                          <div className="flex gap-2 pb-0.5">
                            <button
                              onClick={() => saveQuickEdit(m.id)}
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
        title="Delete this team member?"
        message={`${deleteTarget?.name} will be removed from your team section. Their photo stays in the Media Library. This can't be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={`Delete ${selected.size} team members?`}
        message="These members will be removed from your team section. Their photos stay in the Media Library. This can't be undone."
        loading={deleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
}
