"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Search, Star, Trash2, Zap } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

type Status = "pending" | "approved" | "rejected";
type BulkAction = "" | "delete" | "approve" | "reject" | "feature" | "unfeature";
interface Review { id: number; name: string; email: string; rating: number; content: string | null; status: Status; featured: number; created_at: string }
interface Pagination { page: number; pageSize: number; total: number; totalPages: number }

export function ReviewsList() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [working, setWorking] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Review | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickStatus, setQuickStatus] = useState<Status>("pending");
  const [quickFeatured, setQuickFeatured] = useState(false);

  const load = useCallback(async (query: string, status: string, currentPage: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(currentPage) });
      if (query) params.set("search", query);
      if (status) params.set("status", status);
      const response = await fetch(`/api/admin/reviews?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load reviews.");
      setReviews(data.reviews); setPagination(data.pagination); setError(null);
    } catch (err) { setError(err instanceof Error ? err.message : "Failed to load reviews."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); setSelected(new Set()); void load(search, statusFilter, 1); }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, load]);
  useEffect(() => { setSelected(new Set()); void load(search, statusFilter, page); }, [page, search, statusFilter, load]);

  function openQuickEdit(review: Review) {
    setQuickEditId(review.id); setQuickStatus(review.status); setQuickFeatured(Boolean(review.featured));
  }

  async function updateReview(id: number, body: object) {
    const response = await fetch(`/api/admin/reviews/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Update failed."); }
  }

  async function applyBulk() {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === "delete") { setConfirmBulkDelete(true); return; }
    setWorking(true); setError(null);
    try {
      if (bulkAction === "approve" || bulkAction === "reject") {
        const response = await fetch("/api/admin/reviews", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [...selected], status: bulkAction === "approve" ? "approved" : "rejected" }) });
        if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Bulk action failed."); }
      } else for (const id of selected) await updateReview(id, { featured: bulkAction === "feature" });
      setSelected(new Set()); setBulkAction(""); void load(search, statusFilter, page);
    } catch (err) { setError(err instanceof Error ? err.message : "Bulk action failed."); }
    finally { setWorking(false); }
  }

  async function deleteReviews(ids: number[]) {
    setWorking(true); setError(null);
    try {
      const response = await fetch("/api/admin/reviews", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Delete failed."); }
      setDeleteTarget(null); setConfirmBulkDelete(false); setSelected(new Set()); setBulkAction(""); void load(search, statusFilter, page);
    } catch (err) { setError(err instanceof Error ? err.message : "Delete failed."); }
    finally { setWorking(false); }
  }

  async function saveQuickEdit(id: number) {
    setWorking(true); setError(null);
    try { await updateReview(id, { status: quickStatus, featured: quickFeatured }); setQuickEditId(null); void load(search, statusFilter, page); }
    catch (err) { setError(err instanceof Error ? err.message : "Update failed."); }
    finally { setWorking(false); }
  }

  const allSelected = reviews.length > 0 && selected.size === reviews.length;
  const toggle = (id: number) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(reviews.map((review) => review.id)));

  return <div>
    <div className="mb-6"><h1 className="text-2xl font-bold text-foreground">Reviews</h1><p className="mt-1 text-sm text-muted">Manage customer reviews shown on your site.</p></div>
    {error && <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">{error}</div>}
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2"><div className="relative max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, email, or content..." className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson" /></div><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson"><option value="">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div>
      <div className="flex items-center gap-2"><select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as BulkAction)} disabled={!selected.size} className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-crimson disabled:opacity-50"><option value="">Bulk actions</option><option value="approve">Approve</option><option value="reject">Reject</option><option value="feature">Mark Featured</option><option value="unfeature">Remove Featured</option><option value="delete">Delete</option></select><button onClick={() => void applyBulk()} disabled={!bulkAction || !selected.size || working} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:opacity-50">{working && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Apply ({selected.size})</button></div>
    </div>
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">{loading ? <div className="p-10 text-center text-sm text-muted">Loading...</div> : !reviews.length ? <div className="p-10 text-center text-sm text-muted">{search || statusFilter ? "No reviews match your filters." : "No reviews yet."}</div> : <table className="w-full min-w-[720px] text-left text-sm"><thead><tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted"><th className="w-10 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" /></th><th className="px-2 py-3">Review</th><th className="px-5 py-3">Rating</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr></thead><tbody>{reviews.map((review) => <Fragment key={review.id}><tr className="border-b border-border last:border-0 hover:bg-surface/60"><td className="px-4 py-3"><input type="checkbox" checked={selected.has(review.id)} onChange={() => toggle(review.id)} aria-label={`Select review from ${review.name}`} /></td><td className="px-2 py-3"><p className="font-medium text-foreground">{review.name}</p><p className="text-xs text-muted">{review.email}</p><p className="mt-1 max-w-sm truncate text-xs text-foreground/80">{review.content}</p>{Boolean(review.featured) && <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-crimson"><Star className="h-3 w-3 fill-current" />Featured</span>}</td><td className="px-5 py-3"><div className="flex items-center gap-1">{Array.from({ length: 5 }, (_, index) => <Star key={index} className={`h-3.5 w-3.5 ${index < review.rating ? "fill-crimson text-crimson" : "text-border"}`} />)}</div></td><td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${review.status === "approved" ? "bg-green-100 text-green-700" : review.status === "rejected" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>{review.status[0].toUpperCase() + review.status.slice(1)}</span></td><td className="px-5 py-3"><div className="flex justify-end gap-1.5"><button onClick={() => quickEditId === review.id ? setQuickEditId(null) : openQuickEdit(review)} title="Quick Edit" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-crimson hover:text-crimson"><Zap className="h-3.5 w-3.5" /></button><button onClick={() => setDeleteTarget(review)} title="Delete" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted hover:border-crimson hover:text-crimson"><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>{quickEditId === review.id && <tr className="border-b border-border bg-surface/70"><td colSpan={5} className="px-5 py-4"><div className="flex flex-wrap items-end gap-3"><div><label className="mb-1 block text-xs font-medium text-muted">Status</label><select value={quickStatus} onChange={(event) => setQuickStatus(event.target.value as Status)} className="w-40 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground"><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div><label className="flex items-center gap-1.5 pb-2"><input type="checkbox" checked={quickFeatured} onChange={(event) => setQuickFeatured(event.target.checked)} /><span className="text-sm text-foreground">Featured</span></label><button onClick={() => void saveQuickEdit(review.id)} disabled={working} className="rounded-lg bg-crimson px-3 py-1.5 text-sm font-semibold text-white">Save</button><button onClick={() => setQuickEditId(null)} className="rounded-lg border border-border px-3 py-1.5 text-sm">Cancel</button></div></td></tr>}</Fragment>)}</tbody></table>}</div>
    {pagination && pagination.totalPages > 1 && <div className="mt-4 flex items-center justify-between"><p className="text-xs text-muted">Showing {(pagination.page - 1) * pagination.pageSize + 1}-{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total}</p><div className="flex items-center gap-1.5"><button onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="px-2 text-sm">Page {page} of {pagination.totalPages}</span><button onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))} disabled={page >= pagination.totalPages} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>}
    <ConfirmDialog open={deleteTarget !== null} title="Delete this review?" message={`The review from "${deleteTarget?.name}" will be permanently removed. This can't be undone.`} loading={working} onConfirm={() => deleteTarget && void deleteReviews([deleteTarget.id])} onCancel={() => setDeleteTarget(null)} />
    <ConfirmDialog open={confirmBulkDelete} title={`Delete ${selected.size} reviews?`} message="These reviews will be permanently removed. This can't be undone." loading={working} onConfirm={() => void deleteReviews([...selected])} onCancel={() => setConfirmBulkDelete(false)} />
  </div>;
}