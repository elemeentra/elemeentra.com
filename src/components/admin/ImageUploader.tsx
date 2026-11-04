"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, Loader2, Crop } from "lucide-react";
import { useImageCropper } from "@/components/admin/ImageCropModal";

interface ImageUploaderProps {
  label?: string;
  value: string | null; // current image URL
  onChange: (url: string | null) => void;
  compact?: boolean;
  /** Full-width aspect-video card with a "Choose Image" / "Change Image" text
   * button below the preview — matches the Featured Image sidebar box style. */
  wide?: boolean;
  /** Initial crop ratio (width / height) offered in the cropper. */
  aspect?: number | null;
  /** Circular preview and 1:1 crop — profile photos, team avatars. */
  round?: boolean;
  /** Show the whole image (logos) instead of filling the box. */
  contain?: boolean;
  /** Crop dialog title. */
  cropTitle?: string;
}

export function ImageUploader({
  label,
  value,
  onChange,
  compact = false,
  wide = false,
  aspect = null,
  round = false,
  contain = false,
  cropTitle,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { crop, cropper } = useImageCropper();

  const boxSize = wide ? "aspect-video w-full" : compact ? "h-24 w-24" : round ? "h-32 w-32" : "h-32 w-48";
  const shape = round ? "rounded-full" : wide ? "rounded-md" : "rounded-lg";
  const fit = contain ? "object-contain p-1.5" : "object-cover";
  const cropOpts = { aspect: round ? 1 : aspect, round, title: cropTitle };

  async function upload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }
      onChange(data.url);
    } catch {
      setError("Network error during upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleFile(file: File) {
    const prepared = await crop(file, cropOpts);
    if (inputRef.current) inputRef.current.value = "";
    if (!prepared) return; // cancelled in the cropper
    await upload(prepared);
  }

  /** Re-open the cropper on the image that is already saved. */
  async function adjustExisting() {
    if (!value) return;
    setError(null);
    try {
      const res = await fetch(value);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const name = value.split("/").pop()?.split("?")[0] || "image";
      const ext = name.split(".").pop()?.toLowerCase();
      const byExt = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : "image/webp";
      // Never trust a missing/odd content-type: the cropper only opens for image/* files.
      const type = blob.type.startsWith("image/") ? blob.type : byExt;
      const prepared = await crop(new File([blob], name, { type }), cropOpts);
      if (prepared && prepared.name !== name) await upload(prepared); // skip re-upload when nothing changed
    } catch {
      setError("Couldn't load the current image to adjust. Upload it again instead.");
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
      }}
    />
  );

  const labelEl = label && <label className="mb-1.5 block text-sm font-medium text-foreground">{label}</label>;

  if (wide) {
    return (
      <div>
        {labelEl}

        <div className={`relative overflow-hidden border border-border bg-surface ${shape} ${boxSize}`}>
          {value ? (
            <Image src={value} alt="" fill className={fit} unoptimized />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted">
              <Upload className="h-6 w-6" />
            </div>
          )}
        </div>

        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex-1 rounded-md bg-surface py-2 text-sm font-medium text-foreground transition hover:bg-border disabled:opacity-60"
          >
            {uploading ? (
              <span className="flex items-center justify-center gap-1.5">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading…
              </span>
            ) : value ? (
              "Change Image"
            ) : (
              "Choose Image"
            )}
          </button>
          {value && (
            <button
              type="button"
              onClick={adjustExisting}
              disabled={uploading}
              title="Crop / adjust image"
              className="rounded-md bg-surface px-3 text-muted transition hover:bg-crimson-light hover:text-crimson"
            >
              <Crop className="h-4 w-4" />
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              title="Remove image"
              className="rounded-md bg-surface px-3 text-muted transition hover:bg-crimson-light hover:text-crimson"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {fileInput}
        {cropper}
        {error && <p className="mt-1.5 text-xs text-crimson">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      {labelEl}

      {value ? (
        <div className="relative inline-block">
          <div className={`relative overflow-hidden border border-border bg-surface ${shape} ${boxSize}`}>
            <Image src={value} alt="" fill className={fit} unoptimized />
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                <Loader2 className="h-5 w-5 animate-spin text-crimson" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-crimson text-white shadow"
            title="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="mt-2 flex gap-1.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-md bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-border disabled:opacity-60"
            >
              Change
            </button>
            <button
              type="button"
              onClick={adjustExisting}
              disabled={uploading}
              className="flex items-center gap-1 rounded-md bg-surface px-2.5 py-1 text-xs font-semibold text-foreground transition hover:bg-crimson-light hover:text-crimson disabled:opacity-60"
            >
              <Crop className="h-3 w-3" /> Adjust
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`flex flex-col items-center justify-center gap-1.5 border border-dashed border-border text-muted transition hover:border-crimson hover:text-crimson disabled:opacity-60 ${shape} ${boxSize}`}
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Upload className="h-5 w-5" />
              {!compact && <span className="text-xs">Click to upload</span>}
            </>
          )}
        </button>
      )}

      {fileInput}
      {cropper}
      {error && <p className="mt-1.5 text-xs text-crimson">{error}</p>}
    </div>
  );
}
