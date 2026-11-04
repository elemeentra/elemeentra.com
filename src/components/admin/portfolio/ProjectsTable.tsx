"use client";

import { getJson, peek } from "@/lib/admin-cache";
import { useEffect, useState, useCallback, Fragment } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Star,
  ImageOff,
  ChevronLeft,
  ChevronRight,
  Zap,
  Loader2,
} from "lucide-react";
import { useAdminBase } from "@/lib/use-admin-base";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface ProjectListItem {
  id: number;
  title: string;
  slug: string;
  category: string;
  client_name: string | null;
  image_url: string | null;
  featured: number;
  display_order: number;
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

type BulkAction = "" | "delete" | "feature" | "unfeature";

export function ProjectsTable() {
  const adminBase = useAdminBase();
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [bulkWorking, setBulkWorking] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ProjectListItem | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEditForm, setQuickEditForm] = useState({
    category: "",
    client_name: "",
    display_order: 0,
    featured: false,
  });
  const [quickEditSaving, setQuickEditSaving] = useState(false);

  const load = useCallback(async (q: string, p: number) => {
    const params = new URLSearchParams({ page: String(p) });
    if (q) params.set("search", q);
    const url = `/api/admin/portfolio?${params.toString()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = (data: any) => {
      setProjects(data.projects);
      setPagination(data.pagination);
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
      load(search, 1);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    load(search, page);
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
    setSelected((prev) => (prev.size === projects.length ? new Set() : new Set(projects.map((p) => p.id))));
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/portfolio/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete.");
        return;
      }
      setDeleteTarget(null);
      load(search, page);
    } finally {
      setDeleting(false);
    }
  }

  async function confirmBulkDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/portfolio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to delete selected projects.");
        return;
      }
      setBulkDeleteConfirm(false);
      setSelected(new Set());
      setBulkAction("");
      load(search, page);
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
      const res = await fetch("/api/admin/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), featured: bulkAction === "feature" }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Bulk action failed.");
        return;
      }
      setSelected(new Set());
      setBulkAction("");
      load(search, page);
    } finally {
      setBulkWorking(false);
    }
  }

  function openQuickEdit(p: ProjectListItem) {
    setQuickEditId(p.id);
    setQuickEditForm({
      category: p.category,
      client_name: p.client_name ?? "",
      display_order: p.display_order,
      featured: Boolean(p.featured),
    });
  }

  async function saveQuickEdit(id: number) {
    setQuickEditSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/portfolio/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quickEditForm),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to save changes.");
        return;
      }
      setQuickEditId(null);
      load(search, page);
    } finally {
      setQuickEditSaving(false);
    }
  }

  const allSelected = projects.length > 0 && selected.size === projects.length;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
          <p className="mt-1 text-sm text-muted">Manage the projects shown on your public portfolio.</p>
        </div>
        <Link
          href={`${adminBase}/portfolio/new`}
          className="flex items-center gap-1.5 rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, category, or client…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson"
          />
        </div>

        {/* WordPress-style bulk actions: select an action, then Apply */}
        <div className="flex items-center gap-2">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value as BulkAction)}
            disabled={selected.size === 0}
            className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-crimson disabled:opacity-50"
          >
            <option value="">Bulk actions</option>
            <option value="delete">Delete</option>
            <option value="feature">Mark as Featured</option>
            <option value="unfeature">Remove Featured</option>
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
        ) : projects.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted">
            {search ? "No projects match your search." : "No projects yet — add your first one."}
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
                <th className="px-2 py-3">Project</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Client</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <Fragment key={p.id}>
                  <tr className="group border-b border-border last:border-0 hover:bg-surface/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleOne(p.id)}
                        className="h-4 w-4 rounded border-border accent-crimson"
                        aria-label={`Select ${p.title}`}
                      />
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-surface">
                          {p.image_url ? (
                            <Image src={p.image_url} alt="" fill className="object-cover" unoptimized />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-muted">
                              <ImageOff className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{p.title}</p>
                          {Boolean(p.featured) && (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-crimson">
                              <Star className="h-3 w-3 fill-current" /> Featured
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-foreground/80">{p.category}</td>
                    <td className="px-5 py-3 text-foreground/80">{p.client_name || "—"}</td>
                    <td className="px-5 py-3 text-foreground/80">{p.display_order}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => (quickEditId === p.id ? setQuickEditId(null) : openQuickEdit(p))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Quick Edit"
                        >
                          <Zap className="h-3.5 w-3.5" />
                        </button>
                        <Link
                          href={`${adminBase}/portfolio/${p.id}/edit`}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Edit"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {quickEditId === p.id && (
                    <tr className="border-b border-border bg-surface/70">
                      <td colSpan={6} className="px-5 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Category</label>
                            <input
                              value={quickEditForm.category}
                              onChange={(e) =>
                                setQuickEditForm((f) => ({ ...f, category: e.target.value }))
                              }
                              className="w-44 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Client</label>
                            <input
                              value={quickEditForm.client_name}
                              onChange={(e) =>
                                setQuickEditForm((f) => ({ ...f, client_name: e.target.value }))
                              }
                              className="w-44 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-muted">Order</label>
                            <input
                              type="number"
                              value={quickEditForm.display_order}
                              onChange={(e) =>
                                setQuickEditForm((f) => ({ ...f, display_order: Number(e.target.value) }))
                              }
                              className="w-20 rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-crimson"
                            />
                          </div>
                          <label className="flex items-center gap-1.5 pb-2">
                            <input
                              type="checkbox"
                              checked={quickEditForm.featured}
                              onChange={(e) =>
                                setQuickEditForm((f) => ({ ...f, featured: e.target.checked }))
                              }
                              className="h-4 w-4 rounded border-border accent-crimson"
                            />
                            <span className="text-sm text-foreground">Featured</span>
                          </label>
                          <div className="flex gap-2 pb-0.5">
                            <button
                              onClick={() => saveQuickEdit(p.id)}
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
        title="Delete this project?"
        message={`"${deleteTarget?.title}" will be permanently removed. This can't be undone.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        open={bulkDeleteConfirm}
        title={`Delete ${selected.size} projects?`}
        message="These projects will be permanently removed. This can't be undone."
        loading={deleting}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirm(false)}
      />
    </div>
  );
}
