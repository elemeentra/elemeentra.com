"use client";

import { getJson, peek } from "@/lib/admin-cache";
import { useCallback, useEffect, useState, Fragment } from "react";
import {
  Search, MessageSquare, Reply, Pencil, CheckCircle2, RotateCcw, ShieldAlert, Trash2, XCircle,
  Loader2, ChevronLeft, ChevronRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

type ModStatus = "pending" | "approved" | "spam" | "trash";

interface CommentItem {
  id: number;
  post_title: string | null;
  post_slug: string | null;
  name: string;
  email: string;
  comment_text: string | null;
  moderation_status: ModStatus;
  parent_id: number | null;
  created_at: string | null;
}
interface Pagination { page: number; totalPages: number; total: number }
type Counts = Record<"all" | "mine" | "pending" | "approved" | "spam" | "trash", number>;

const TABS: { key: keyof Counts; label: string }[] = [
  { key: "all", label: "All" }, { key: "mine", label: "Mine" }, { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" }, { key: "spam", label: "Spam" }, { key: "trash", label: "Trash" },
];

const BADGE: Record<ModStatus, string> = {
  approved: "bg-green-500/10 text-green-700 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  spam: "bg-orange-500/10 text-orange-700 border-orange-500/20",
  trash: "bg-red-500/10 text-red-600 border-red-500/20",
};

const inputCls = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson";
const iconBtn = "flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition";

function bulkOptionsFor(tab: string) {
  const del = { v: "delete", l: "Delete permanently" };
  if (tab === "approved") return [{ v: "unapprove", l: "Unapprove" }, { v: "spam", l: "Mark as spam" }, { v: "trash", l: "Move to Trash" }, del];
  if (tab === "spam") return [{ v: "restore", l: "Not spam" }, { v: "trash", l: "Move to Trash" }, del];
  if (tab === "trash") return [{ v: "restore", l: "Restore" }, del];
  return [{ v: "approve", l: "Approve" }, { v: "spam", l: "Mark as spam" }, { v: "trash", l: "Move to Trash" }, del];
}

const BULK_STATUS: Record<string, ModStatus> = {
  approve: "approved", unapprove: "pending", spam: "spam", trash: "trash", restore: "pending",
};

export function CommentsList() {
  const [items, setItems] = useState<CommentItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, mine: 0, pending: 0, approved: 0, spam: 0, trash: 0 });
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<keyof Counts>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [deleteIds, setDeleteIds] = useState<number[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [panel, setPanel] = useState<{ id: number; mode: "reply" | "edit" } | null>(null);
  const [draft, setDraft] = useState("");
  const [panelSaving, setPanelSaving] = useState(false);

  const load = useCallback(async (t: string, q: string, p: number) => {
    const params = new URLSearchParams({ status: t, page: String(p) });
    if (q) params.set("search", q);
    const url = `/api/admin/comments?${params.toString()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = (data: any) => {
      setItems(data.items);
      setCounts(data.counts);
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
    const t = setTimeout(() => { setPage(1); setSelected(new Set()); load(tab, search, 1); }, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  useEffect(() => { load(tab, search, page); setSelected(new Set()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const reload = () => load(tab, search, page);

  async function setStatus(ids: number[], status: ModStatus): Promise<boolean> {
    setError(null);
    const res = await fetch("/api/admin/comments", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, status }),
    });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Action failed."); return false; }
    return true;
  }
  async function single(id: number, status: ModStatus) { if (await setStatus([id], status)) reload(); }

  async function applyBulk() {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === "delete") { setDeleteIds(Array.from(selected)); return; }
    setWorking(true);
    try {
      if (await setStatus(Array.from(selected), BULK_STATUS[bulkAction])) { setSelected(new Set()); setBulkAction(""); reload(); }
    } finally { setWorking(false); }
  }

  async function confirmDelete() {
    if (!deleteIds) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/comments", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: deleteIds }),
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Delete failed."); return; }
      setDeleteIds(null); setSelected(new Set()); setBulkAction(""); reload();
    } finally { setDeleting(false); }
  }

  function openPanel(c: CommentItem, mode: "reply" | "edit") {
    setError(null);
    if (panel?.id === c.id && panel.mode === mode) { setPanel(null); return; }
    setPanel({ id: c.id, mode });
    setDraft(mode === "edit" ? c.comment_text ?? "" : "");
  }

  async function savePanel() {
    if (!panel || !draft.trim()) return;
    setPanelSaving(true);
    setError(null);
    try {
      const res = panel.mode === "reply"
        ? await fetch(`/api/admin/comments/${panel.id}/reply`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: draft }),
          })
        : await fetch(`/api/admin/comments/${panel.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment_text: draft }),
          });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Could not save."); return; }
      setPanel(null); setDraft(""); reload();
    } finally { setPanelSaving(false); }
  }

  const toggleOne = (id: number) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  const fmt = (v: string | null) => (v ? new Date(v.replace(" ", "T").slice(0, 19) + "Z").toLocaleDateString() : "—");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Comments</h1>
        <p className="mt-1 text-sm text-muted">Moderate, reply to and organise blog comments.</p>
      </div>

      {error && <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson" role="alert">{error}</div>}

      <div className="mb-4 flex flex-wrap items-center gap-1 text-sm">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setBulkAction(""); }}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${tab === t.key ? "bg-crimson-light text-crimson" : "text-muted hover:text-foreground"}`}>
            {t.label} <span className="opacity-60">({counts[t.key] ?? 0})</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value)} className={`${inputCls} w-48`} aria-label="Bulk actions">
          <option value="">Bulk actions</option>
          {bulkOptionsFor(tab).map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
        <button onClick={applyBulk} disabled={!bulkAction || selected.size === 0 || working}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50">
          {working && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Apply {selected.size > 0 && <span className="text-muted">({selected.size})</span>}
        </button>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search comments…" className={`${inputCls} w-full pl-9`} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted"><MessageSquare className="mx-auto mb-3 h-10 w-10 opacity-30" />No comments found.</div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-crimson" aria-label="Select all" /></th>
                <th className="px-3 py-3">Author</th><th className="px-3 py-3">Comment</th><th className="px-3 py-3">Post</th>
                <th className="px-3 py-3">Status</th><th className="px-3 py-3">Date</th><th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((c) => (
                <Fragment key={c.id}>
                  <tr className="align-top transition hover:bg-surface/60">
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="h-4 w-4 accent-crimson" aria-label={`Select comment by ${c.name}`} /></td>
                    <td className="px-3 py-3"><p className="font-semibold text-foreground">{c.name}</p><p className="text-xs text-muted">{c.email}</p></td>
                    <td className="max-w-md px-3 py-3 text-foreground">
                      {c.parent_id && <span className="mr-1 rounded bg-surface px-1.5 py-0.5 text-[10px] font-bold uppercase text-muted">↳ reply</span>}
                      <span className="whitespace-pre-line">{c.comment_text}</span>
                    </td>
                    <td className="px-3 py-3 text-xs">
                      {c.post_slug ? <a href={`/blog/${c.post_slug}`} target="_blank" rel="noopener noreferrer" className="text-crimson hover:underline">{c.post_title ?? c.post_slug}</a> : <span className="text-muted">—</span>}
                    </td>
                    <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${BADGE[c.moderation_status]}`}>{c.moderation_status}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted">{fmt(c.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {c.moderation_status === "approved" && <button onClick={() => openPanel(c, "reply")} title="Reply" className={`${iconBtn} hover:border-blue-500 hover:text-blue-600`}><Reply className="h-3.5 w-3.5" /></button>}
                        <button onClick={() => openPanel(c, "edit")} title="Edit" className={`${iconBtn} hover:border-crimson hover:text-crimson`}><Pencil className="h-3.5 w-3.5" /></button>
                        {c.moderation_status === "approved"
                          ? <button onClick={() => single(c.id, "pending")} title="Unapprove" className={`${iconBtn} hover:border-yellow-500 hover:text-yellow-600`}><RotateCcw className="h-3.5 w-3.5" /></button>
                          : c.moderation_status === "pending"
                            ? <button onClick={() => single(c.id, "approved")} title="Approve" className={`${iconBtn} hover:border-green-600 hover:text-green-600`}><CheckCircle2 className="h-3.5 w-3.5" /></button>
                            : <button onClick={() => single(c.id, "pending")} title={c.moderation_status === "spam" ? "Not spam" : "Restore"} className={`${iconBtn} hover:border-green-600 hover:text-green-600`}><RotateCcw className="h-3.5 w-3.5" /></button>}
                        {c.moderation_status !== "spam" && c.moderation_status !== "trash" && <button onClick={() => single(c.id, "spam")} title="Mark as spam" className={`${iconBtn} hover:border-orange-500 hover:text-orange-600`}><ShieldAlert className="h-3.5 w-3.5" /></button>}
                        {c.moderation_status !== "trash"
                          ? <button onClick={() => single(c.id, "trash")} title="Move to Trash" className={`${iconBtn} hover:border-crimson hover:text-crimson`}><Trash2 className="h-3.5 w-3.5" /></button>
                          : <button onClick={() => setDeleteIds([c.id])} title="Delete permanently" className={`${iconBtn} hover:border-crimson hover:text-crimson`}><XCircle className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                  {panel?.id === c.id && (
                    <tr className="bg-surface/60">
                      <td />
                      <td colSpan={6} className="px-3 py-4">
                        <label className="mb-1 block text-xs font-medium text-muted">
                          {panel.mode === "reply" ? `Reply to ${c.name} (published immediately under their comment)` : "Edit comment"}
                        </label>
                        <textarea autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} rows={4} maxLength={5000} className={`${inputCls} w-full`} />
                        <div className="mt-3 flex gap-2">
                          <button onClick={savePanel} disabled={panelSaving || !draft.trim()}
                            className="flex items-center gap-1.5 rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
                            {panelSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {panel.mode === "reply" ? "Post Reply" : "Save"}
                          </button>
                          <button onClick={() => setPanel(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-background">Cancel</button>
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
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} comments</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border p-2 hover:bg-surface disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="rounded-lg border border-border p-2 hover:bg-surface disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteIds !== null}
        title="Delete permanently?"
        message={`${deleteIds?.length ?? 0} comment(s) will be deleted forever. This cannot be undone.`}
        confirmLabel="Delete permanently"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteIds(null)}
      />
    </div>
  );
}
