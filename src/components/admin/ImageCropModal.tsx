"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Crop, RotateCcw, RotateCw, X, ZoomIn, ZoomOut, Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* Public API                                                         */
/* ------------------------------------------------------------------ */

export interface CropOptions {
  /** Initial crop ratio (width / height). Omit to start with the image's own ratio. */
  aspect?: number | null;
  /** Circular preview + locked 1:1 (profile photos, team avatars). */
  round?: boolean;
  title?: string;
  /** Position in a multi-file upload, e.g. { index: 2, total: 5 }. */
  queue?: { index: number; total: number };
  /** Longest side of the exported image, px. */
  maxSize?: number;
}

/**
 * Promise-based cropper so every upload entry point can do:
 *   const file = await crop(original, { aspect: 16 / 9 });
 *   if (!file) return; // cancelled
 * and render `{cropper}` once in its JSX.
 */
export function useImageCropper(): {
  crop: (file: File, opts?: CropOptions) => Promise<File | null>;
  cropper: ReactNode;
} {
  const [job, setJob] = useState<{ file: File; opts: CropOptions; resolve: (f: File | null) => void } | null>(null);
  const skipAll = useRef(false);

  const crop = useCallback((file: File, opts: CropOptions = {}) => {
    // Animated GIFs and SVGs would lose their nature on a canvas — upload as-is.
    if (!file.type.startsWith("image/") || /gif|svg/.test(file.type)) return Promise.resolve(file);
    if (opts.queue && opts.queue.index === 1) skipAll.current = false;
    if (skipAll.current) return Promise.resolve(file);
    return new Promise<File | null>((resolve) => setJob({ file, opts, resolve }));
  }, []);

  const finish = useCallback(
    (result: File | null, skipRest?: boolean) => {
      if (skipRest) skipAll.current = true;
      job?.resolve(result);
      setJob(null);
    },
    [job]
  );

  const cropper = job ? <ImageCropModal key={`${job.file.name}-${job.file.size}-${job.file.lastModified}`} file={job.file} opts={job.opts} onFinish={finish} /> : null;
  return { crop, cropper };
}

/* ------------------------------------------------------------------ */
/* Modal                                                              */
/* ------------------------------------------------------------------ */

const STAGE_W = 640;
const STAGE_H = 380;
const PAD = 28;

const PRESETS: { label: string; value: number | null }[] = [
  { label: "Original", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
  { label: "1.91:1", value: 1.91 },
];

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function ImageCropModal({
  file,
  opts,
  onFinish,
}: {
  file: File;
  opts: CropOptions;
  onFinish: (result: File | null, skipRest?: boolean) => void;
}) {
  const { round = false, queue, maxSize = 2400 } = opts;

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [aspect, setAspect] = useState<number | null>(round ? 1 : opts.aspect ?? null);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0); // quarter turns
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [skipRest, setSkipRest] = useState(false);

  const stageRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  // Load the picked file.
  useEffect(() => {
    // `cancelled` matters: React dev mode mounts → unmounts → mounts every effect.
    // The first run's URL gets revoked, its <img> then fires `error`, and without
    // this flag that stale error closed the dialog the instant it opened.
    let cancelled = false;
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      if (!cancelled) setImg(el);
    };
    el.onerror = () => {
      if (!cancelled) onFinish(file); // genuinely can't decode in-browser → upload original
    };
    el.src = url;
    return () => {
      cancelled = true;
      el.onload = null;
      el.onerror = null;
      URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  // Geometry --------------------------------------------------------
  const geo = useMemo(() => {
    if (!img) return null;
    const sideways = rot % 2 === 1;
    const ew = sideways ? img.naturalHeight : img.naturalWidth;
    const eh = sideways ? img.naturalWidth : img.naturalHeight;
    const a = round ? 1 : aspect ?? ew / eh;
    const maxW = STAGE_W - PAD * 2;
    const maxH = STAGE_H - PAD * 2;
    const frameW = maxW / a <= maxH ? maxW : maxH * a;
    const frameH = frameW / a;
    const base = Math.max(frameW / ew, frameH / eh);
    const scale = base * zoom;
    const limX = Math.max(0, (ew * scale - frameW) / 2);
    const limY = Math.max(0, (eh * scale - frameH) / 2);
    return { ew, eh, a, frameW, frameH, scale, limX, limY };
  }, [img, rot, aspect, round, zoom]);

  const ox = geo ? clamp(off.x, -geo.limX, geo.limX) : 0;
  const oy = geo ? clamp(off.y, -geo.limY, geo.limY) : 0;

  const paint = useCallback(
    (ctx: CanvasRenderingContext2D, cx: number, cy: number, k: number) => {
      if (!img || !geo) return;
      ctx.save();
      ctx.translate(cx + ox * k, cy + oy * k);
      ctx.rotate((rot * Math.PI) / 2);
      ctx.scale(geo.scale * k, geo.scale * k);
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      ctx.restore();
    },
    [img, geo, ox, oy, rot]
  );

  // Draw stage + preview -------------------------------------------
  useEffect(() => {
    const canvas = stageRef.current;
    if (!canvas || !geo) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, STAGE_W, STAGE_H);
    ctx.fillStyle = "#14110f";
    ctx.fillRect(0, 0, STAGE_W, STAGE_H);
    paint(ctx, STAGE_W / 2, STAGE_H / 2, 1);

    const fx = (STAGE_W - geo.frameW) / 2;
    const fy = (STAGE_H - geo.frameH) / 2;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,.58)";
    ctx.beginPath();
    ctx.rect(0, 0, STAGE_W, STAGE_H);
    if (round) ctx.ellipse(STAGE_W / 2, STAGE_H / 2, geo.frameW / 2, geo.frameH / 2, 0, 0, Math.PI * 2);
    else ctx.rect(fx, fy, geo.frameW, geo.frameH);
    ctx.fill("evenodd");
    ctx.restore();

    ctx.strokeStyle = "rgba(255,255,255,.95)";
    ctx.lineWidth = 2;
    if (round) {
      ctx.beginPath();
      ctx.ellipse(STAGE_W / 2, STAGE_H / 2, geo.frameW / 2, geo.frameH / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeRect(fx, fy, geo.frameW, geo.frameH);
      ctx.strokeStyle = "rgba(255,255,255,.28)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i <= 2; i++) {
        ctx.moveTo(fx + (geo.frameW * i) / 3, fy);
        ctx.lineTo(fx + (geo.frameW * i) / 3, fy + geo.frameH);
        ctx.moveTo(fx, fy + (geo.frameH * i) / 3);
        ctx.lineTo(fx + geo.frameW, fy + (geo.frameH * i) / 3);
      }
      ctx.stroke();
    }

    const pv = previewRef.current;
    const pctx = pv?.getContext("2d");
    if (pv && pctx) {
      const box = 168;
      const pw = geo.a >= 1 ? box : Math.round(box * geo.a);
      const ph = geo.a >= 1 ? Math.round(box / geo.a) : box;
      if (pv.width !== pw) pv.width = pw;
      if (pv.height !== ph) pv.height = ph;
      pctx.clearRect(0, 0, pw, ph);
      paint(pctx, pw / 2, ph / 2, pw / geo.frameW);
    }
  }, [geo, paint, round]);

  // Pointer / wheel -------------------------------------------------
  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drag.current || !geo) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const f = STAGE_W / rect.width;
    const dx = (e.clientX - drag.current.x) * f;
    const dy = (e.clientY - drag.current.y) * f;
    drag.current = { x: e.clientX, y: e.clientY };
    setOff({ x: clamp(ox + dx, -geo.limX, geo.limX), y: clamp(oy + dy, -geo.limY, geo.limY) });
  }
  function onPointerUp() {
    drag.current = null;
  }
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom((z) => clamp(z * Math.exp(-e.deltaY * 0.0015), 1, 6));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [img]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFinish(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onFinish]);

  // Export ----------------------------------------------------------
  async function exportCrop() {
    if (!img || !geo) return;
    setBusy(true);
    try {
      let outW = Math.round(geo.frameW / geo.scale);
      let outH = Math.round(geo.frameH / geo.scale);
      const longest = Math.max(outW, outH);
      if (longest > maxSize) {
        outW = Math.round((outW * maxSize) / longest);
        outH = Math.round((outH * maxSize) / longest);
      }
      outW = Math.max(1, outW);
      outH = Math.max(1, outH);
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return onFinish(file);
      const keepAlpha = /png|webp/.test(file.type);
      if (!keepAlpha) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, outW, outH);
      }
      paint(ctx, outW / 2, outH / 2, outW / geo.frameW);
      const mime = keepAlpha ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, mime, 0.92));
      if (!blob) return onFinish(file);
      const base = file.name.replace(/\.[^.]+$/, "") || "image";
      const ext = keepAlpha ? "png" : "jpg";
      onFinish(new File([blob], `${base}-cropped.${ext}`, { type: mime }), skipRest);
    } finally {
      setBusy(false);
    }
  }

  const chips = useMemo(() => {
    const list = [...PRESETS];
    const want = opts.aspect;
    if (want && !list.some((p) => p.value && Math.abs(p.value - want) < 0.01)) {
      list.splice(1, 0, { label: `${Number(want.toFixed(2))}:1`, value: want });
    }
    return list;
  }, [opts.aspect]);

  const selectedChip = chips.findIndex((p) => (p.value === null ? aspect === null : aspect !== null && Math.abs(p.value - aspect) < 0.01));

  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Crop image">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Crop size={18} className="text-crimson" />
            <h2 className="text-base font-extrabold text-foreground">{opts.title ?? "Crop & adjust image"}</h2>
            {queue && queue.total > 1 && (
              <span className="rounded-full bg-crimson-light px-2.5 py-0.5 text-xs font-bold text-crimson">
                {queue.index} of {queue.total}
              </span>
            )}
          </div>
          <button type="button" onClick={() => onFinish(null)} aria-label="Cancel" className="rounded-lg p-1.5 text-muted transition hover:bg-surface hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[1fr_200px]">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-xl bg-[#14110f]">
              {img ? (
                <canvas
                  ref={stageRef}
                  width={STAGE_W}
                  height={STAGE_H}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="block h-auto w-full cursor-grab touch-none active:cursor-grabbing"
                />
              ) : (
                <div className="flex aspect-[640/380] items-center justify-center text-white/70">
                  <Loader2 className="animate-spin" />
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">Drag to move · scroll or use the slider to zoom</p>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => setZoom((z) => clamp(z / 1.15, 1, 6))} aria-label="Zoom out" className="rounded-lg border border-border p-2 text-muted transition hover:text-crimson">
                <ZoomOut size={16} />
              </button>
              <input type="range" min={1} max={6} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" className="h-1.5 min-w-[140px] flex-1 accent-crimson" />
              <button type="button" onClick={() => setZoom((z) => clamp(z * 1.15, 1, 6))} aria-label="Zoom in" className="rounded-lg border border-border p-2 text-muted transition hover:text-crimson">
                <ZoomIn size={16} />
              </button>
              <span className="mx-1 h-6 w-px bg-border" />
              <button type="button" onClick={() => { setRot((r) => (r + 3) % 4); setOff({ x: 0, y: 0 }); }} aria-label="Rotate left" className="rounded-lg border border-border p-2 text-muted transition hover:text-crimson">
                <RotateCcw size={16} />
              </button>
              <button type="button" onClick={() => { setRot((r) => (r + 1) % 4); setOff({ x: 0, y: 0 }); }} aria-label="Rotate right" className="rounded-lg border border-border p-2 text-muted transition hover:text-crimson">
                <RotateCw size={16} />
              </button>
            </div>

            {!round && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {chips.map((p, i) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => { setAspect(p.value); setOff({ x: 0, y: 0 }); }}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                      i === selectedChip ? "border-crimson bg-crimson text-white" : "border-border bg-card text-muted hover:border-crimson hover:text-crimson"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">Preview</p>
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-border bg-[repeating-conic-gradient(#f1ecec_0%_25%,#fff_0%_50%)] bg-[length:16px_16px] p-3">
              <canvas ref={previewRef} width={168} height={168} className={`max-w-full ${round ? "rounded-full" : "rounded-md"} shadow-md`} />
            </div>
            {geo && (
              <p className="mt-2 text-xs text-muted">
                Output ≈ {Math.min(Math.round(geo.frameW / geo.scale), maxSize)} × {Math.min(Math.round(geo.frameH / geo.scale), maxSize)} px
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3.5">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onFinish(file, skipRest)} className="text-sm font-semibold text-muted underline-offset-2 transition hover:text-crimson hover:underline">
              Use original
            </button>
            {queue && queue.total > 1 && queue.index < queue.total && (
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={skipRest} onChange={(e) => setSkipRest(e.target.checked)} className="h-3.5 w-3.5 accent-crimson" />
                Don&apos;t crop the rest
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => onFinish(null)} className="rounded-xl border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition hover:bg-surface">
              Cancel
            </button>
            <button type="button" onClick={exportCrop} disabled={!img || busy} className="flex items-center gap-2 rounded-xl bg-crimson px-5 py-2 text-sm font-bold text-white transition hover:bg-crimson-hover disabled:opacity-60">
              {busy && <Loader2 size={15} className="animate-spin" />}
              Crop &amp; use
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
