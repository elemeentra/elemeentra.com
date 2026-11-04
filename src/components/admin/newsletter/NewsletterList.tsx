"use client";

import { useState, Fragment } from "react";
import { Search, Trash2, Zap, Loader2, Download } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminList } from "@/components/admin/useAdminList";
import { formatDateTime } from "@/lib/date-utils";

interface SubscriberItem {
  id: number;
  email: string;
  subscribed_at: string | null;
  unsubscribed_at: string | null;
}

interface SubscriberStats {
  total: number;
  active: number;
  unsubscribed: number;
}

type BulkAction = "" | "unsubscribe" | "resubscribe" | "delete";

const JSON_HEADERS = { "Content-Type": "application/json" };

export function NewsletterList() {
  const list = useAdminList<SubscriberItem, SubscriberStats>("/api/admin/newsletter");
  const { items, stats, selected, setSelected } = list;

  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [bulkWorking, setBulkWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<SubscriberItem | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEditSubscribed, setQuickEditSubscribed] = useState(true);
  const [quickEditSaving, setQuickEditSaving] = useState(false);

  const exportHref = `/api/admin/newsletter/export${list.statusFilter ? `?status=${list.statusFilter}` : ""}`;

  function openQuickEdit(s: SubscriberItem) {
    setQuickEditId(s.id);
    setQuickEditSubscribed(!s.unsubscribed_at);
  }

  async function saveQuickEdit(id: number) {
    setQuickEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/newsletter/${id}`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ subscribed: quickEditSubscribed }),
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/newsletter/${deleteTarget.id}`, { method: "DELETE" });
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
      const res = await fetch("/api/admin/newsletter", {
        method: "DELETE",
        headers: JSON_HEADERS,
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete selected subscribers.");
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
    setBulkWorking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/newsletter", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ ids: Array.from(selected), action: bulkAction }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Bulk action failed.");
        return;
      }
      setSelected(new Set());
      setBulkAction("");
      list.reload();
    } finally {
      setBulkWorking(false);
    }
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const shownError = error ?? list.loadError;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Newsletter</h1>
          <p className="mt-1 text-sm text-muted">People subscribed to your newsletter.</p>
          {stats && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border bg-card px-3 py-1 text-foreground">
                Total <strong>{stats.total}</strong>
              </span>
              <span className="rounded-full border border-crimson/30 bg-crimson-light px-3 py-1 text-crimson">
                Active <strong>{stats.active}</strong>
              </span>
              <span className="rounded-full border border-border bg-card px-3 py-1 text-foreground">
                Unsubscribed <strong>{stats.unsubscribed}</strong>
              </span>
            </div>
          )}
        </div>
        <a
          href={exportHref}
          className="flex items-center gap-1.5 rounded-lg bg-crimson px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </a>
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
              placeholder="Search by email…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson"
            />
          </div>
          <select
            value={list.statusFilter}
            onChange={(e) => list.setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson"
          >
            <option value="">All subscribers</option>
            <option value="active">Active</option>
            <option value="unsubscribed">Unsubscribed</option>
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
            <option value="unsubscribe">Unsubscribe</option>
            <option value="resubscribe">Resubscribe</option>
            <option value="delete">Delete</option>
          </select>
          <button
            onClick={applyBulkAction}
            disabled={selected.size === 0 || !bulkAction || bulkWorking}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
          >
            {bulkWorking && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
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
            {list.search || list.statusFilter ? "No subscribers match your filters." : "No subscribers yet."}
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
                <th className="px-2 py-3">Email</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Subscribed</th>
                <th className="px-5 py-3">Unsubscribed</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <Fragment key={s.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => list.toggleOne(s.id)}
                        className="h-4 w-4 rounded border-border accent-crimson"
                        aria-label={`Select ${s.email}`}
                      />
                    </td>
                    <td className="px-2 py-3 font-medium text-foreground">{s.email}</td>
                    <td className="px-5 py-3">
                      <StatusBadge tone={s.unsubscribed_at ? "gray" : "green"}>
                        {s.unsubscribed_at ? "Unsubscribed" : "Active"}
                      </StatusBadge>
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                      {s.subscribed_at ? formatDateTime(s.subscribed_at) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-muted">
                      {s.unsubscribed_at ? formatDateTime(s.unsubscribed_at) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => (quickEditId === s.id ? setQuickEditId(null) : openQuickEdit(s))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Quick Edit"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(s)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {quickEditId === s.id && (
                    <tr className="border-b border-border bg-surface/70">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Status</label>
                            <select
                              value={quickEditSubscribed ? "active" : "unsubscribed"}
                              onChange={(e) => setQuickEditSubscribed(e.target.value === "active")}
                              className="w-44 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson"
                            >
                              <option value="active">Active</option>
                              <option value="unsubscribed">Unsubscribed</option>
                            </select>
                          </div>
                          <div className="flex gap-2 pb-0.5">
                            <button
                              onClick={() => saveQuickEdit(s.id)}
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
        title="Delete this subscriber?"
        message={`${deleteTarget?.email} will be permanently removed from the list. This can't be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={`Delete ${selected.size} subscribers?`}
        message="These subscribers will be permanently removed. This can't be undone."
        loading={deleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
}
