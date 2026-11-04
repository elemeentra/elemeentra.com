"use client";

import { useImageCropper } from "@/components/admin/ImageCropModal";
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Search, Upload, X, ImageIcon } from "lucide-react";

interface PickerItem {
  id: number;
  filename: string;
  file_url: string;
  thumbnail_url: string | null;
  alt_text?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen image URL. */
  onSelect: (url: string) => void;
}

/** Pick an existing image from the Media Library, or upload a new one. */
export function MediaPickerModal({ open, onClose, onSelect }: Props) {
  const [items, setItems] = useState<PickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { crop, cropper } = useImageCropper();

  const load = useCallback(async (q: string, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(p) });
      if (q) params.set("search", q);
      const res = await fetch(`/api/admin/media?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load media.");
      setItems(data.items ?? []);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load media.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(search, page), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [open, search, page, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function handleUpload(original: File) {
    const file = await crop(original, { title: "Crop & adjust image" });
    if (!file) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      onSelect(data.url); // a fresh upload is picked straight away
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Media library">
      <div className="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <h2 className="text-base font-bold text-foreground">Media Library</h2>
          <div className="relative ml-auto w-full max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search files…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-crimson"
            />
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 rounded-lg bg-crimson px-3 py-2 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:opacity-60">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload
          </button>
          <button onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        {error && <p className="px-4 pt-3 text-sm text-crimson" role="alert">{error}</p>}

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="py-16 text-center text-sm text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
          ) : items.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted"><ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-30" />No images found.</div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
              {items.map((it) => (
                <button key={it.id} type="button" onClick={() => onSelect(it.file_url)}
                  className="group overflow-hidden rounded-lg border border-border bg-background text-left transition hover:border-crimson">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.thumbnail_url || it.file_url} alt={it.alt_text || it.filename} loading="lazy" className="aspect-square w-full object-cover" />
                  <p className="truncate px-2 py-1.5 text-[11px] text-muted group-hover:text-foreground">{it.filename}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="rounded-lg border border-border px-3 py-1 hover:bg-surface disabled:opacity-40">Prev</button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="rounded-lg border border-border px-3 py-1 hover:bg-surface disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
      </div>
      {cropper}
    </div>
  );
}
