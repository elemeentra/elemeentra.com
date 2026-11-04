"use client";

import { getJson, peek } from "@/lib/admin-cache";
import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import {
  Plus, Search, Pencil, Trash2, Eye, RotateCcw, XCircle, FileText,
  ChevronLeft, ChevronRight, Zap, Loader2,
} from "lucide-react";
import { useAdminBase } from "@/lib/use-admin-base";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

type PostStatus = "draft" | "pending" | "scheduled" | "published" | "trash";

interface BlogPostItem {
  id: number;
  title: string;
  slug: string;
  featured_image?: string | null;
  status: PostStatus;
  category_names: string | null;
  tags: string[];
  comment_count: number;
  seo_score: number | null;
  focus_keyword: string | null;
  published_at: string | null;
  scheduled_at: string | null;
  created_at: string;
}

interface Pagination { page: number; pageSize: number; total: number; totalPages: number }
interface CategoryRef { id: number; name: string }

const STATUS_TABS: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "pending", label: "Pending" },
  { key: "scheduled", label: "Scheduled" },
  { key: "published", label: "Published" },
  { key: "trash", label: "Trash" },
];

const STATUS_BADGE: Record<PostStatus, string> = {
  draft: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  scheduled: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  published: "bg-green-500/10 text-green-700 border-green-500/20",
  trash: "bg-red-500/10 text-red-600 border-red-500/20",
};

function seoBadge(score: number | null): string {
  if (score === null) return "bg-gray-500/10 text-muted border-gray-500/20";
  if (score >= 80) return "bg-green-500/10 text-green-700 border-green-500/20";
  if (score >= 50) return "bg-yellow-500/10 text-yellow-700 border-yellow-500/20";
  return "bg-red-500/10 text-red-600 border-red-500/20";
}

/** DB timestamps are UTC "YYYY-MM-DD HH:MM:SS". */
function formatDbDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T").slice(0, 19) + "Z");
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

const inputCls = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson";

export function BlogsList() {
  const adminBase = useAdminBase();
  const [posts, setPosts] = useState<BlogPostItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<CategoryRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [bulkWorking, setBulkWorking] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<BlogPostItem | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEditForm, setQuickEditForm] = useState<{ title: string; status: PostStatus }>({ title: "", status: "draft" });
  const [quickEditSaving, setQuickEditSaving] = useState(false);

  const isTrashTab = statusFilter === "trash";

  const load = useCallback(async (q: string, st: string, cat: string, p: number) => {
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set("search", q);
    if (st && st !== "all") params.set("status", st);
    if (cat) params.set("category", cat);
    const url = `/api/admin/blog?${params.toString()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = (data: any) => {
      setPosts(data.posts);
      setPagination(data.pagination);
      setCounts(data.counts ?? {});
    };
    const hit = peek(url);
    if (hit) apply(hit); // instant paint, refreshed below
    setLoading(!hit);
    try {
      const res = await getJson(url);
      if (res.ok) apply(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/admin/categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = d?.categories ?? d?.items ?? (Array.isArray(d) ? d : []);
        setCategories(list as CategoryRef[]);
      })
      .catch(() => undefined);
  }, []);

  // Filters changed → back to page 1 (search is debounced).
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setSelected(new Set());
      load(search, statusFilter, categoryFilter, 1);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, categoryFilter]);

  useEffect(() => {
    load(search, statusFilter, categoryFilter, page);
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const reload = () => load(search, statusFilter, categoryFilter, page);

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const toggleAll = () => setSelected((prev) => (prev.size === posts.length ? new Set() : new Set(posts.map((p) => p.id))));

  /** Change status of one or many posts (trash / restore / draft / publish …). */
  async function setStatus(ids: number[], status: PostStatus): Promise<boolean> {
    setError(null);
    const res = await fetch("/api/admin/blog", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Action failed.");
      return false;
    }
    return true;
  }

  async function trashOne(p: BlogPostItem) {
    if (await setStatus([p.id], "trash")) reload();
  }
  async function restoreOne(p: BlogPostItem) {
    if (await setStatus([p.id], "draft")) reload();
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/blog/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete.");
        return;
      }
      setDeleteTarget(null);
      reload();
    } finally {
      setDeleting(false);
    }
  }

  async function confirmBulkDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/blog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to delete selected posts.");
        return;
      }
      setBulkDeleteConfirm(false);
      setSelected(new Set());
      setBulkAction("");
      reload();
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
    const map: Record<string, PostStatus> = {
      publish: "published", draft: "draft", pending: "pending", trash: "trash", restore: "draft",
    };
    setBulkWorking(true);
    try {
      if (await setStatus(Array.from(selected), map[bulkAction])) {
        setSelected(new Set());
        setBulkAction("");
        reload();
      }
    } finally {
      setBulkWorking(false);
    }
  }

  function openQuickEdit(p: BlogPostItem) {
    setQuickEditId(p.id);
    setQuickEditForm({ title: p.title, status: p.status === "trash" ? "draft" : p.status });
  }

  async function saveQuickEdit(id: number) {
    setQuickEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/blog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quickEditForm),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      setQuickEditId(null);
      reload();
    } finally {
      setQuickEditSaving(false);
    }
  }

  const allSelected = posts.length > 0 && selected.size === posts.length;
  const bulkOptions = isTrashTab
    ? [{ v: "restore", l: "Restore" }, { v: "delete", l: "Delete Permanently" }]
    : [
        { v: "publish", l: "Publish" }, { v: "draft", l: "Move to Draft" },
        { v: "pending", l: "Mark as Pending" }, { v: "trash", l: "Move to Trash" },
      ];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Blog Posts</h1>
          <p className="mt-1 text-sm text-muted">Manage your blog content.</p>
        </div>
        <Link
          href={`${adminBase}/blog/new`}
          className="flex items-center gap-1.5 rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover"
        >
          <Plus className="h-4 w-4" />
          Add Post
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">{error}</div>
      )}

      {/* Status tabs with live counts */}
      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => { setStatusFilter(tab.key); setBulkAction(""); }}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              statusFilter === tab.key ? "bg-crimson-light text-crimson" : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label} <span className="opacity-60">({counts[tab.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className={`${inputCls} w-44`} aria-label="Bulk actions">
          <option value="">Bulk actions</option>
          {bulkOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
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
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={`${inputCls} w-48`} aria-label="Filter by category">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts…"
            className={`${inputCls} w-full pl-9`}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading…</div>
        ) : posts.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            <FileText className="mx-auto mb-3 h-10 w-10 opacity-30" />
            {search || categoryFilter || statusFilter !== "all" ? "No posts found." : "No posts yet — create your first one."}
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="w-10 px-4 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 rounded border-border accent-crimson" aria-label="Select all" />
                </th>
                <th className="px-2 py-3">Title</th>
                <th className="px-4 py-3">Categories</th>
                <th className="px-4 py-3">Tags</th>
                <th className="px-4 py-3 text-center">Comments</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">SEO</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {posts.map((p) => (
                <Fragment key={p.id}>
                  <tr className="align-top transition hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} className="h-4 w-4 rounded border-border accent-crimson" aria-label={`Select ${p.title}`} />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-start gap-3">
                        {p.featured_image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.featured_image} alt="" loading="lazy"
                            className="h-10 w-14 shrink-0 rounded-md border border-border object-cover"
                            onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                        ) : (
                          <div className="h-10 w-14 shrink-0 rounded-md border border-dashed border-border bg-surface" />
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{p.title || "(untitled)"}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                            <Link href={`${adminBase}/blog/${p.id}/edit`} className="flex items-center gap-1 hover:text-foreground"><Pencil className="h-3 w-3" /> Edit</Link>
                            <button onClick={() => openQuickEdit(p)} className="flex items-center gap-1 hover:text-foreground"><Zap className="h-3 w-3" /> Quick Edit</button>
                            <Link
                              href={p.status === "published" ? `/blog/${p.slug}` : `/blog/preview/${p.id}`}
                              target="_blank"
                              className="flex items-center gap-1 hover:text-foreground"
                            >
                              <Eye className="h-3 w-3" /> {p.status === "published" ? "View" : "Preview"}
                            </Link>
                            {isTrashTab ? (
                              <>
                                <button onClick={() => restoreOne(p)} className="flex items-center gap-1 hover:text-green-600"><RotateCcw className="h-3 w-3" /> Restore</button>
                                <button onClick={() => setDeleteTarget(p)} className="flex items-center gap-1 hover:text-crimson"><XCircle className="h-3 w-3" /> Delete</button>
                              </>
                            ) : (
                              <button onClick={() => trashOne(p)} className="flex items-center gap-1 hover:text-crimson"><Trash2 className="h-3 w-3" /> Trash</button>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{p.category_names || "—"}</td>
                    <td className="px-4 py-3 text-muted">{p.tags.length ? p.tags.join(", ") : "—"}</td>
                    <td className="px-4 py-3 text-center text-muted">{p.comment_count}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${STATUS_BADGE[p.status]}`}>{p.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${seoBadge(p.seo_score)}`}>
                        {p.seo_score !== null ? `${p.seo_score}/100` : "—"}
                      </span>
                      {p.focus_keyword && <p className="mt-1 text-[10px] text-muted">{p.focus_keyword}</p>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                      {formatDbDate(p.published_at || p.scheduled_at || p.created_at)}
                    </td>
                  </tr>
                  {quickEditId === p.id && (
                    <tr className="bg-surface/60">
                      <td />
                      <td colSpan={7} className="px-2 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="min-w-[220px] flex-1">
                            <label className="mb-1 block text-xs font-medium text-muted">Title</label>
                            <input value={quickEditForm.title} onChange={(e) => setQuickEditForm((f) => ({ ...f, title: e.target.value }))} className={`${inputCls} w-full`} />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Status</label>
                            <select value={quickEditForm.status} onChange={(e) => setQuickEditForm((f) => ({ ...f, status: e.target.value as PostStatus }))} className={inputCls}>
                              <option value="draft">Draft</option>
                              <option value="pending">Pending</option>
                              <option value="published">Published</option>
                              <option value="scheduled">Scheduled</option>
                            </select>
                          </div>
                          <button onClick={() => saveQuickEdit(p.id)} disabled={quickEditSaving || !quickEditForm.title.trim()}
                            className="flex items-center gap-1.5 rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
                            {quickEditSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Update
                          </button>
                          <button onClick={() => setQuickEditId(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background">Cancel</button>
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
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} posts</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border p-2 transition hover:bg-surface disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="rounded-lg border border-border p-2 transition hover:bg-surface disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete post permanently?"
        message={deleteTarget ? `“${deleteTarget.title}” will be deleted forever. This cannot be undone.` : ""}
        confirmLabel="Delete permanently"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
      <ConfirmDialog
        open={bulkDeleteConfirm}
        title="Delete selected posts permanently?"
        message={`${selected.size} post(s) will be deleted forever. This cannot be undone.`}
        confirmLabel="Delete permanently"
        loading={deleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
}
