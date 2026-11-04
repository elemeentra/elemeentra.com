"use client";

import { getJson, peek } from "@/lib/admin-cache";
import { useEffect, useState, useCallback, Fragment } from "react";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Zap,
  Loader2,
  Star,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface ReviewItem {
  id: number;
  name: string;
  email: string;
  rating: number;
  content: string;
  status: "pending" | "approved" | "rejected";
  featured: number;
  created_at: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type BulkAction = "" | "delete" | "approve" | "reject" | "feature" | "unfeature";

export function ReviewsList() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [bulkWorking, setBulkWorking] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ReviewItem | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEditForm, setQuickEditForm] = useState<{
    status: "pending" | "approved" | "rejected";
    featured: boolean;
  }>({ status: "pending", featured: false });
  const [quickEditSaving, setQuickEditSaving] = useState(false);
  const [featuredSupported, setFeaturedSupported] = useState(true);

  const load = useCallback(async (q: string, st: string, p: number) => {
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set("search", q);
    if (st) params.set("status", st);
    const url = `/api/admin/reviews?${params.toString()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = (data: any) => {
      setReviews(data.reviews);
      setPagination(data.pagination);
      if (typeof data.featuredSupported === "boolean") setFeaturedSupported(data.featuredSupported);
    };
    const hit = peek(url);
    if (hit) apply(hit);
    setLoading(!hit);
    try {
      const res = await getJson(url);
      if (res.ok) apply(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSelected(new Set());
      load(search, statusFilter, 1);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  useEffect(() => {
    load(search, statusFilter, page);
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === reviews.length ? new Set() : new Set(reviews.map((r) => r.id))));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete.");
        return;
      }
      setDeleteTarget(null);
      load(search, statusFilter, page);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmBulkDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete selected reviews.");
        return;
      }
      setBulkDeleteConfirm(false);
      setSelected(new Set());
      setBulkAction("");
      load(search, statusFilter, page);
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
      if (["approve", "reject"].includes(bulkAction)) {
        const bulkPayload = {
          ids: Array.from(selected),
          status: bulkAction === "approve" ? "approved" : "rejected",
        };
        const res = await fetch("/api/admin/reviews", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(bulkPayload),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Bulk action failed.");
          setBulkWorking(false);
          return;
        }
      } else if (["feature", "unfeature"].includes(bulkAction)) {
        // Bulk feature/unfeature requires PATCH on each item (no batch endpoint for this)
        for (const id of selected) {
          const res = await fetch(`/api/admin/reviews/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ featured: bulkAction === "feature" }),
          });
          if (!res.ok) {
            const data = await res.json();
            setError(data.error ?? "Failed to update review.");
            setBulkWorking(false);
            return;
          }
        }
      }

      setSelected(new Set());
      setBulkAction("");
      load(search, statusFilter, page);
    } finally {
      setBulkWorking(false);
    }
  }

  function openQuickEdit(r: ReviewItem) {
    setQuickEditId(r.id);
    setQuickEditForm({ status: r.status, featured: Boolean(r.featured) });
  }

  async function saveQuickEdit(id: number) {
    // Send only what actually changed — a status change must never touch `featured`.
    const original = reviews.find((r) => r.id === id);
    const payload: { status?: string; featured?: boolean } = {};
    if (!original || quickEditForm.status !== original.status) payload.status = quickEditForm.status;
    if (featuredSupported && (!original || quickEditForm.featured !== Boolean(original.featured))) {
      payload.featured = quickEditForm.featured;
    }
    if (Object.keys(payload).length === 0) {
      setQuickEditId(null);
      return;
    }
    setQuickEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      setQuickEditId(null);
      load(search, statusFilter, page);
    } finally {
      setQuickEditSaving(false);
    }
  }

  const allSelected = reviews.length > 0 && selected.size === reviews.length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Reviews</h1>
        <p className="mt-1 text-sm text-muted">Manage customer reviews shown on your site.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, or content…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
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
            <option value="approve">Approve</option>
            <option value="reject">Reject</option>
            {featuredSupported && <option value="feature">Mark Featured</option>}
            {featuredSupported && <option value="unfeature">Remove Featured</option>}
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
        {loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading…</div>
        ) : reviews.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            {search || statusFilter ? "No reviews match your filters." : "No reviews yet."}
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-border accent-crimson"
                    aria-label="Select all"
                  />
                </th>
                <th className="px-2 py-3">Review</th>
                <th className="px-5 py-3">Rating</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-b border-border last:border-0 hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(r.id)}
                        onChange={() => toggleOne(r.id)}
                        className="h-4 w-4 rounded border-border accent-crimson"
                        aria-label={`Select review from ${r.name}`}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div>
                        <p className="font-medium text-foreground">{r.name}</p>
                        <p className="text-xs text-muted">{r.email}</p>
                        <p className="mt-1 max-w-sm truncate text-xs text-foreground/80">{r.content}</p>
                        {Boolean(r.featured) && (
                          <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-crimson">
                            <Star className="h-3 w-3 fill-current" /> Featured
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < r.rating ? "fill-crimson text-crimson" : "text-border"
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          r.status === "approved"
                            ? "bg-green-100 text-green-700"
                            : r.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {r.status === "approved" ? "Approved" : r.status === "rejected" ? "Rejected" : "Pending"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => (quickEditId === r.id ? setQuickEditId(null) : openQuickEdit(r))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Quick Edit"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {quickEditId === r.id && (
                    <tr className="border-b border-border bg-surface/70">
                      <td colSpan={5} className="px-5 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Status</label>
                            <select
                              value={quickEditForm.status}
                              onChange={(e) =>
                                setQuickEditForm((f) => ({
                                  ...f,
                                  status: e.target.value as "pending" | "approved" | "rejected",
                                }))
                              }
                              className="w-40 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson"
                            >
                              <option value="pending">Pending</option>
                              <option value="approved">Approved</option>
                              <option value="rejected">Rejected</option>
                            </select>
                          </div>
                          {featuredSupported && <label className="flex items-center gap-1.5 pb-2">
                            <input
                              type="checkbox"
                              checked={quickEditForm.featured}
                              onChange={(e) =>
                                setQuickEditForm((f) => ({ ...f, featured: e.target.checked }))
                              }
                              className="h-4 w-4 rounded border-border accent-crimson"
                            />
                            <span className="text-sm text-foreground">Featured</span>
                          </label>}
                          <div className="flex gap-2 pb-0.5">
                            <button
                              onClick={() => saveQuickEdit(r.id)}
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

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted">
            Showing {(pagination.page - 1) * pagination.pageSize + 1}–
            {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pagination.page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-sm text-foreground">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={pagination.page >= pagination.totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this review?"
        message={`The review from "${deleteTarget?.name}" will be permanently removed. This can't be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={`Delete ${selected.size} reviews?`}
        message="These reviews will be permanently removed. This can't be undone."
        loading={deleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
}
