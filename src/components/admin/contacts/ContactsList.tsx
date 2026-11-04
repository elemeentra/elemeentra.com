"use client";

import { getJson, peek } from "@/lib/admin-cache";
import { useCallback, useEffect, useState, Fragment } from "react";
import {
  Search, Mail, Phone, Reply, Eye, CheckCircle2, Trash2, RotateCcw, XCircle, Download, Loader2,
  ChevronLeft, ChevronRight, Send, X,
} from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

interface ContactItem {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  service_interested: string | null;
  message: string | null;
  is_read: boolean;
  replied: boolean;
  replied_at: string | null;
  reply_message?: string | null;
  created_at: string | null;
}
interface Pagination { page: number; totalPages: number; total: number }
type Counts = Record<"all" | "unread" | "read" | "replied" | "trash", number>;

const TABS: { key: keyof Counts; label: string }[] = [
  { key: "all", label: "All" }, { key: "unread", label: "Unread" }, { key: "read", label: "Read" },
  { key: "replied", label: "Replied" }, { key: "trash", label: "Trash" },
];

const inputCls = "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson";
const iconBtn = "flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition";

function bulkOptionsFor(tab: string) {
  if (tab === "trash") return [{ v: "restore", l: "Restore" }, { v: "delete", l: "Delete permanently" }];
  return [
    { v: "read", l: "Mark as read" }, { v: "unread", l: "Mark as unread" },
    { v: "trash", l: "Move to Trash" }, { v: "delete", l: "Delete permanently" },
  ];
}

const fmt = (v: string | null) => (v ? new Date(v.replace(" ", "T").slice(0, 19) + "Z").toLocaleString() : "—");

export function ContactsList() {
  const [items, setItems] = useState<ContactItem[]>([]);
  const [counts, setCounts] = useState<Counts>({ all: 0, unread: 0, read: 0, replied: 0, trash: 0 });
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<keyof Counts>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  const [deleteIds, setDeleteIds] = useState<number[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [replyTo, setReplyTo] = useState<ContactItem | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const load = useCallback(async (t: string, q: string, p: number) => {
    const params = new URLSearchParams({ status: t, page: String(p) });
    if (q) params.set("search", q);
    const url = `/api/admin/contacts?${params.toString()}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apply = (data: any) => { setItems(data.items); setCounts(data.counts); setPagination(data.pagination); };
    const hit = peek(url);
    if (hit) apply(hit);
    setLoading(!hit);
    try {
      const res = await getJson(url);
      if (res.ok) apply(res.data);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSelected(new Set()); load(tab, search, 1); }, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, search]);

  useEffect(() => { load(tab, search, page); setSelected(new Set()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const reload = () => load(tab, search, page);

  async function bulk(ids: number[], action: string): Promise<boolean> {
    setError(null);
    const res = await fetch("/api/admin/contacts", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, action }),
    });
    if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Action failed."); return false; }
    return true;
  }
  async function single(id: number, action: string) { if (await bulk([id], action)) reload(); }

  async function applyBulk() {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === "delete") { setDeleteIds(Array.from(selected)); return; }
    setWorking(true);
    try { if (await bulk(Array.from(selected), bulkAction)) { setSelected(new Set()); setBulkAction(""); reload(); } }
    finally { setWorking(false); }
  }

  async function confirmDelete() {
    if (!deleteIds) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/contacts", {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: deleteIds }),
      });
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error ?? "Delete failed."); return; }
      setDeleteIds(null); setSelected(new Set()); setBulkAction(""); reload();
    } finally { setDeleting(false); }
  }

  function toggleView(c: ContactItem) {
    const open = expanded === c.id ? null : c.id;
    setExpanded(open);
    if (open && !c.is_read) single(c.id, "read"); // opening a message marks it read
  }

  function openReply(c: ContactItem) {
    setReplyTo(c);
    setReplyError(null);
    setSubject(`Re: your enquiry${c.service_interested ? ` about ${c.service_interested}` : ""}`);
    setBody(`Hi ${c.name},\n\nThanks for reaching out.\n\n\n\nBest regards,\nElemeentra`);
  }

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyTo) return;
    setSending(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/admin/contacts/${replyTo.id}/reply`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, message: body }),
      });
      if (!res.ok) { setReplyError((await res.json().catch(() => ({}))).error ?? "Could not send the reply."); return; }
      setReplyTo(null);
      reload();
    } finally { setSending(false); }
  }

  const toggleOne = (id: number) => setSelected((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((i) => i.id)));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contact Messages</h1>
          <p className="mt-1 text-sm text-muted">Enquiries from your website contact form.</p>
        </div>
        <a href="/api/admin/contacts/export" className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface">
          <Download className="h-4 w-4" /> Export CSV
        </a>
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
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search messages…" className={`${inputCls} w-full pl-9`} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        {loading ? (
          <div className="p-10 text-center text-sm text-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted"><Mail className="mx-auto mb-3 h-10 w-10 opacity-30" />No messages found.</div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="w-10 px-4 py-3"><input type="checkbox" checked={allSelected} onChange={toggleAll} className="h-4 w-4 accent-crimson" aria-label="Select all" /></th>
                <th className="px-3 py-3">From</th><th className="px-3 py-3">Message</th><th className="px-3 py-3">Service</th>
                <th className="px-3 py-3">Status</th><th className="px-3 py-3">Received</th><th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((c) => (
                <Fragment key={c.id}>
                  <tr className={`align-top transition hover:bg-surface/60 ${!c.is_read && tab !== "trash" ? "bg-crimson-light/30" : ""}`}>
                    <td className="px-4 py-3"><input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleOne(c.id)} className="h-4 w-4 accent-crimson" aria-label={`Select message from ${c.name}`} /></td>
                    <td className="px-3 py-3">
                      <p className="flex items-center gap-2 font-semibold text-foreground">
                        {!c.is_read && <span className="h-2 w-2 shrink-0 rounded-full bg-crimson" aria-label="Unread" />}{c.name}
                      </p>
                      <a href={`mailto:${c.email}`} className="text-xs text-crimson hover:underline">{c.email}</a>
                      {c.phone && <p className="mt-0.5 flex items-center gap-1 text-xs text-muted"><Phone className="h-3 w-3" />{c.phone}</p>}
                    </td>
                    <td className="max-w-md px-3 py-3 text-muted"><p className="line-clamp-2 whitespace-pre-line">{c.message}</p></td>
                    <td className="px-3 py-3 text-xs text-muted">{c.service_interested || "—"}</td>
                    <td className="px-3 py-3">
                      {c.replied
                        ? <span className="inline-flex items-center gap-1 rounded-full border border-green-500/20 bg-green-500/10 px-2 py-1 text-[10px] font-bold uppercase text-green-700"><CheckCircle2 className="h-3 w-3" />Replied</span>
                        : <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${c.is_read ? "border-gray-500/20 bg-gray-500/10 text-gray-600" : "border-yellow-500/20 bg-yellow-500/10 text-yellow-700"}`}>{c.is_read ? "Read" : "Unread"}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-muted">{fmt(c.created_at)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => toggleView(c)} title="View message" className={`${iconBtn} hover:border-crimson hover:text-crimson`}><Eye className="h-3.5 w-3.5" /></button>
                        {tab !== "trash" && <button onClick={() => openReply(c)} title="Reply by email" className={`${iconBtn} hover:border-blue-500 hover:text-blue-600`}><Reply className="h-3.5 w-3.5" /></button>}
                        {tab !== "trash" && !c.is_read && <button onClick={() => single(c.id, "read")} title="Mark as read" className={`${iconBtn} hover:border-green-600 hover:text-green-600`}><CheckCircle2 className="h-3.5 w-3.5" /></button>}
                        {tab === "trash"
                          ? <>
                              <button onClick={() => single(c.id, "restore")} title="Restore" className={`${iconBtn} hover:border-green-600 hover:text-green-600`}><RotateCcw className="h-3.5 w-3.5" /></button>
                              <button onClick={() => setDeleteIds([c.id])} title="Delete permanently" className={`${iconBtn} hover:border-crimson hover:text-crimson`}><XCircle className="h-3.5 w-3.5" /></button>
                            </>
                          : <button onClick={() => single(c.id, "trash")} title="Move to Trash" className={`${iconBtn} hover:border-crimson hover:text-crimson`}><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </td>
                  </tr>
                  {expanded === c.id && (
                    <tr className="bg-surface/60">
                      <td />
                      <td colSpan={6} className="px-3 py-4">
                        <p className="whitespace-pre-wrap rounded-lg border border-border bg-background p-4 text-sm text-foreground">{c.message}</p>
                        {c.reply_message && (
                          <div className="mt-3">
                            <p className="mb-1 text-xs font-medium text-muted">Your reply · {fmt(c.replied_at)}</p>
                            <p className="whitespace-pre-wrap rounded-lg border border-green-500/20 bg-green-500/5 p-4 text-sm text-foreground">{c.reply_message}</p>
                          </div>
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

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>Page {pagination.page} of {pagination.totalPages} · {pagination.total} messages</span>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border p-2 hover:bg-surface disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <button onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))} disabled={page === pagination.totalPages} className="rounded-lg border border-border p-2 hover:bg-surface disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}

      {/* Reply by email */}
      {replyTo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Reply by email">
          <form onSubmit={sendReply} className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">Reply to {replyTo.name}</h2>
              <button type="button" onClick={() => setReplyTo(null)} className="rounded-lg p-2 text-muted hover:bg-surface" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm"><span className="w-14 text-muted">To</span><span className="font-mono text-foreground">{replyTo.email}</span></div>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-14 text-muted">Subject</span>
                <input required value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} className={`${inputCls} flex-1`} />
              </div>
              <textarea required rows={10} value={body} onChange={(e) => setBody(e.target.value)} maxLength={10000} className={`${inputCls} w-full`} />
              <p className="rounded-lg bg-surface p-3 text-xs text-muted">The original message is quoted below your reply in the email.</p>
              {replyError && <p className="text-sm text-crimson" role="alert">{replyError}</p>}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReplyTo(null)} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface">Cancel</button>
              <button type="submit" disabled={sending}
                className="flex items-center gap-1.5 rounded-lg bg-crimson px-5 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send Reply
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={deleteIds !== null}
        title="Delete permanently?"
        message={`${deleteIds?.length ?? 0} message(s) will be deleted forever. This cannot be undone.`}
        confirmLabel="Delete permanently"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteIds(null)}
      />
    </div>
  );
}
