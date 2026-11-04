import { Loader2, CheckCircle2 } from "lucide-react";

export const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-crimson";

export function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-crimson">*</span>}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-crimson">{error}</p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function FormBanner({ error, saved }: { error: string | null; saved: boolean }) {
  if (error) {
    return (
      <div className="mb-5 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
        {error}
      </div>
    );
  }
  if (saved) {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm text-green-700 dark:bg-green-900/30 dark:text-green-300">
        <CheckCircle2 className="h-4 w-4" /> Settings saved.
      </div>
    );
  }
  return null;
}

export function SaveBar({ dirty, saving, onDiscard }: { dirty: boolean; saving: boolean; onDiscard: () => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="submit"
        disabled={saving || !dirty}
        className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save Changes
      </button>
      {dirty && (
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface disabled:opacity-60"
        >
          Discard
        </button>
      )}
      {dirty && <span className="text-xs text-muted">Unsaved changes</span>}
    </div>
  );
}
