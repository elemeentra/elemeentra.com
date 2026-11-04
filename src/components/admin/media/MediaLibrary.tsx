"use client";

import { useImageCropper } from "@/components/admin/ImageCropModal";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Trash2, Loader2, Upload, X, Copy, Check, ExternalLink } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Pagination } from "@/components/admin/Pagination";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { useAdminList } from "@/components/admin/useAdminList";
import { formatDateTime } from "@/lib/date-utils";
import { formatBytes } from "@/lib/format-utils";
import { useAdminBase } from "@/lib/use-admin-base";

interface MediaItem {
  id: number;
  filename: string;
  file_url: string;
  thumbnail_url: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  uploaded_by: number | null;
  uploaded_at: string | null;
  uploader_name: string | null;
  usage_count: number;
}

interface MediaStats {
  total: number;
  totalSize: number;
  thisMonth: number;
}

interface MediaUsage {
  type: string;
  title: string;
  field: string;
  href: string;
}

interface InUseEntry {
  id: number;
  filename: string;
  usages: MediaUsage[];
}

interface UploadEntry {
  name: string;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
}

type BulkAction = "" | "copy" | "delete";

const JSON_HEADERS = { "Content-Type": "application/json" };
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function shortName(filename: string): string {
  return filename.length > 14 ? `${filename.slice(0, 8)}…${filename.slice(filename.lastIndexOf("."))}` : filename;
}

function buildInUseMessage(inUse: InUseEntry[]): string {
  const shown = inUse.slice(0, 4).map((entry) => {
    const places = entry.usages
      .slice(0, 3)
      .map((u) => `${u.type} “${u.title}” (${u.field})`)
      .join(", ");
    const more = entry.usages.length > 3 ? ` +${entry.usages.length - 3} more` : "";
    return `${shortName(entry.filename)} → ${places}${more}`;
  });
  const extra = inUse.length > 4 ? ` …and ${inUse.length - 4} more file(s).` : "";
  return `Still in use: ${shown.join("; ")}.${extra} Deleting it will leave broken images in those places.`;
}

export function MediaLibrary() {
  const adminBase = useAdminBase();
  const list = useAdminList<MediaItem, MediaStats>("/api/admin/media");
  const { items, stats, selected, setSelected } = list;

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { crop, cropper } = useImageCropper();
  const [uploads, setUploads] = useState<UploadEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  // Bulk + delete
  const [bulkAction, setBulkAction] = useState<BulkAction>("");
  const [deleteIds, setDeleteIds] = useState<number[] | null>(null);
  const [inUseMessage, setInUseMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Details panel
  const [detailId, setDetailId] = useState<number | null>(null);
  const [usages, setUsages] = useState<MediaUsage[] | null>(null);
  const [copied, setCopied] = useState(false);

  const detail = items.find((i) => i.id === detailId) ?? null;

  // Load "where is this used" whenever the details panel opens on a file.
  useEffect(() => {
    if (detailId === null) return;
    let cancelled = false;
    setUsages(null);
    fetch(`/api/admin/media/${detailId}`)
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!cancelled && ok) setUsages(data.item.usages ?? []);
      })
      .catch(() => {
        if (!cancelled) setUsages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [detailId]);

  // Escape closes the details panel (unless a confirm dialog is on top).
  useEffect(() => {
    if (detailId === null || deleteIds !== null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDetailId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId, deleteIds]);

  function patchUpload(index: number, patch: Partial<UploadEntry>) {
    setUploads((prev) => prev.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  }

  async function uploadFiles(files: File[]) {
    if (files.length === 0 || uploading) return;
    setError(null);
    setNotice(null);
    setUploads(files.map((f) => ({ name: f.name, status: "queued" })));
    setUploading(true);

    let succeeded = 0;
    // Sequential on purpose: Sharp processing is memory-heavy, one at a time keeps the server calm.
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!ACCEPTED_TYPES.includes(file.type)) {
        patchUpload(i, { status: "error", error: "Only JPEG, PNG, WebP or GIF." });
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        patchUpload(i, { status: "error", error: "Larger than 10MB." });
        continue;
      }
      const prepared = await crop(file, { queue: { index: i + 1, total: files.length } });
      if (!prepared) {
        patchUpload(i, { status: "error", error: "Skipped (crop cancelled)." });
        continue;
      }
      patchUpload(i, { status: "uploading" });
      try {
        const formData = new FormData();
        formData.append("file", prepared);
        const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          patchUpload(i, { status: "error", error: data.error ?? "Upload failed." });
          continue;
        }
        patchUpload(i, { status: "done" });
        succeeded++;
      } catch {
        patchUpload(i, { status: "error", error: "Network error." });
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (succeeded > 0) {
      if (list.page !== 1) list.setPage(1);
      else list.reload();
    }
  }

  async function copyText(text: string, message?: string) {
    try {
      await navigator.clipboard.writeText(text);
      if (message) setNotice(message);
      return true;
    } catch {
      setError("Couldn't access the clipboard in this browser.");
      return false;
    }
  }

  async function copyDetailPath(path: string) {
    if (await copyText(path)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  function applyBulkAction() {
    if (!bulkAction || selected.size === 0) return;
    if (bulkAction === "delete") {
      setDeleteIds(Array.from(selected));
      return;
    }
    const paths = items.filter((i) => selected.has(i.id)).map((i) => i.file_url);
    copyText(paths.join("\n"), `Copied ${paths.length} file path${paths.length === 1 ? "" : "s"}.`);
    setBulkAction("");
  }

  function closeDelete() {
    setDeleteIds(null);
    setInUseMessage(null);
  }

  async function runDelete(force: boolean) {
    if (!deleteIds) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      const res =
        deleteIds.length === 1
          ? await fetch(`/api/admin/media/${deleteIds[0]}${force ? "?force=1" : ""}`, { method: "DELETE" })
          : await fetch("/api/admin/media", {
              method: "DELETE",
              headers: JSON_HEADERS,
              body: JSON.stringify({ ids: deleteIds, force }),
            });
      const data = await res.json().catch(() => ({}));

      // 409 = still referenced somewhere. Nothing was deleted — warn, let the user decide.
      if (res.status === 409 && Array.isArray(data.inUse)) {
        setInUseMessage(buildInUseMessage(data.inUse as InUseEntry[]));
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Failed to delete.");
        closeDelete();
        return;
      }
      if (data.fileErrors > 0) {
        setNotice(
          `Removed from the library, but ${data.fileErrors} file(s) couldn't be deleted from disk — check server permissions.`
        );
      }
      closeDelete();
      setDetailId(null);
      setSelected(new Set());
      setBulkAction("");
      list.reload();
    } finally {
      setDeleting(false);
    }
  }

  const allSelected = items.length > 0 && selected.size === items.length;
  const shownError = error ?? list.loadError;
  const deleteCount = deleteIds?.length ?? 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Media Library</h1>
        <p className="mt-1 text-sm text-muted">Upload and manage images used across your site.</p>
        {stats && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-foreground">
              Files <strong>{stats.total}</strong>
            </span>
            <span className="rounded-full border border-crimson/30 bg-crimson-light px-3 py-1 text-crimson">
              Storage <strong>{formatBytes(stats.totalSize)}</strong>
            </span>
            <span className="rounded-full border border-border bg-card px-3 py-1 text-foreground">
              This month <strong>{stats.thisMonth}</strong>
            </span>
          </div>
        )}
      </div>

      {shownError && (
        <div className="mb-4 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {shownError}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground">{notice}</div>
      )}

      {/* Upload zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          uploadFiles(Array.from(e.dataTransfer.files));
        }}
        className={`mb-4 rounded-2xl border border-dashed p-6 text-center transition ${
          dragging ? "border-crimson bg-crimson-light" : "border-border bg-card"
        }`}
      >
        <Upload className="mx-auto mb-2 h-6 w-6 text-muted" />
        <p className="text-sm text-foreground">
          Drag &amp; drop images here, or{" "}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="font-semibold text-crimson hover:text-crimson-hover disabled:opacity-60"
          >
            browse files
          </button>
        </p>
        <p className="mt-1 text-xs text-muted">
          JPEG, PNG, WebP or GIF · up to 10MB each · automatically converted to WebP with a thumbnail
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_TYPES.join(",")}
          className="hidden"
          onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))}
        />

        {uploads.length > 0 && (
          <div className="mx-auto mt-4 max-w-md space-y-1.5 text-left">
            {uploads.map((u, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                {u.status === "uploading" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />}
                {u.status === "queued" && <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" />}
                {u.status === "done" && <Check className="h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" />}
                {u.status === "error" && <X className="h-3.5 w-3.5 shrink-0 text-crimson" />}
                <span className="truncate text-foreground">{u.name}</span>
                {u.error && <span className="ml-auto shrink-0 text-crimson">{u.error}</span>}
              </div>
            ))}
            {!uploading && (
              <button
                type="button"
                onClick={() => setUploads([])}
                className="pt-1 text-xs font-medium text-muted hover:text-crimson"
              >
                Clear list
              </button>
            )}
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={list.search}
              onChange={(e) => list.setSearch(e.target.value)}
              placeholder="Search by file name or uploader…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson"
            />
          </div>
          <select
            value={list.statusFilter}
            onChange={(e) => list.setStatusFilter(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson"
          >
            <option value="">All files</option>
            <option value="mine">Uploaded by me</option>
            <option value="month">This month</option>
            <option value="large">Large (over 500KB)</option>
          </select>
          {items.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={list.toggleAll}
                className="h-4 w-4 rounded border-border accent-crimson"
              />
              Select all
            </label>
          )}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={bulkAction}
            onChange={(e) => setBulkAction(e.target.value as BulkAction)}
            disabled={selected.size === 0}
            className="rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground outline-none focus:border-crimson disabled:opacity-50"
          >
            <option value="">Bulk actions</option>
            <option value="copy">Copy file paths</option>
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

      {/* Grid */}
      {list.loading ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">Loading…</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted">
          {list.search || list.statusFilter ? "No files match your filters." : "No files yet. Upload your first image above."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((m) => {
            const isSelected = selected.has(m.id);
            return (
              <div
                key={m.id}
                className={`group relative overflow-hidden rounded-xl border bg-card transition ${
                  isSelected ? "border-crimson ring-1 ring-crimson" : "border-border hover:border-crimson/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setDetailId(m.id)}
                  className="block w-full text-left"
                  aria-label={`View details for ${m.filename}`}
                >
                  <div className="relative aspect-square w-full bg-surface">
                    <Image
                      src={m.thumbnail_url ?? m.file_url}
                      alt={m.filename}
                      fill
                      sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, 33vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="space-y-1.5 px-3 py-2.5">
                    <p className="truncate text-xs font-medium text-foreground" title={m.filename}>
                      {m.filename}
                    </p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted">
                        {formatBytes(m.file_size)}
                        {m.width && m.height ? ` · ${m.width}×${m.height}` : ""}
                      </span>
                      <StatusBadge tone={m.usage_count > 0 ? "green" : "gray"}>
                        {m.usage_count > 0 ? `In use · ${m.usage_count}` : "Unused"}
                      </StatusBadge>
                    </div>
                  </div>
                </button>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => list.toggleOne(m.id)}
                  className="absolute left-2.5 top-2.5 h-4 w-4 rounded border-border accent-crimson"
                  aria-label={`Select ${m.filename}`}
                />
              </div>
            );
          })}
        </div>
      )}

      <Pagination pagination={list.pagination} onPage={list.setPage} />

      {/* Details panel */}
      {detail && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 px-4 py-6"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetailId(null)}
        >
          <div
            className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-lg md:flex-row"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative min-h-[240px] flex-1 bg-surface md:min-h-[420px]">
              <Image
                src={detail.file_url}
                alt={detail.filename}
                fill
                sizes="(min-width: 768px) 60vw, 100vw"
                className="object-contain"
                unoptimized
              />
            </div>

            <div className="w-full shrink-0 overflow-y-auto border-t border-border p-5 md:w-80 md:border-l md:border-t-0">
              <div className="mb-4 flex items-start justify-between gap-2">
                <h2 className="break-all text-sm font-semibold text-foreground">{detail.filename}</h2>
                <button
                  onClick={() => setDetailId(null)}
                  aria-label="Close"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <dl className="space-y-2.5 text-xs">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Size</dt>
                  <dd className="text-foreground">{formatBytes(detail.file_size)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Dimensions</dt>
                  <dd className="text-foreground">
                    {detail.width && detail.height ? `${detail.width} × ${detail.height}` : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Uploaded by</dt>
                  <dd className="text-foreground">{detail.uploader_name ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Uploaded</dt>
                  <dd className="text-foreground">{detail.uploaded_at ? formatDateTime(detail.uploaded_at) : "—"}</dd>
                </div>
              </dl>

              <div className="mt-4">
                <label className="mb-1 block text-xs font-medium text-muted">File path</label>
                <div className="flex gap-1.5">
                  <input
                    readOnly
                    value={detail.file_url}
                    onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground outline-none"
                  />
                  <button
                    onClick={() => copyDetailPath(detail.file_url)}
                    title="Copy path"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                  >
                    {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <a
                    href={detail.file_url}
                    target="_blank"
                    rel="noreferrer"
                    title="Open in new tab"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-1.5 text-xs font-medium text-muted">Used in</p>
                {usages === null ? (
                  <p className="text-xs text-muted">Checking…</p>
                ) : usages.length === 0 ? (
                  <p className="text-xs text-muted">Not used anywhere yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {usages.map((u, i) => (
                      <li key={i} className="rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs">
                        <Link href={`${adminBase}/${u.href}`} className="font-medium text-crimson hover:text-crimson-hover">
                          {u.title}
                        </Link>
                        <span className="block text-muted">
                          {u.type} · {u.field}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button
                onClick={() => setDeleteIds([detail.id])}
                className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-crimson/40 px-3 py-2 text-sm font-semibold text-crimson transition hover:bg-crimson-light"
              >
                <Trash2 className="h-4 w-4" />
                Delete file
              </button>
            </div>
          </div>
        </div>
      )}

      {/* First confirm, then (if the file is referenced) a stronger warning. */}
      <ConfirmDialog
        open={deleteIds !== null && inUseMessage === null}
        title={deleteCount === 1 ? "Delete this file?" : `Delete ${deleteCount} files?`}
        message="The image and its thumbnail will be permanently removed from the server. This can't be undone."
        loading={deleting}
        onConfirm={() => runDelete(false)}
        onCancel={closeDelete}
      />
      <ConfirmDialog
        open={deleteIds !== null && inUseMessage !== null}
        title="This file is in use"
        message={inUseMessage ?? ""}
        confirmLabel="Delete anyway"
        loading={deleting}
        onConfirm={() => runDelete(true)}
        onCancel={closeDelete}
      />
      {cropper}
    </div>
  );
}
