"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, Link2 } from "lucide-react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useAdminBase } from "@/lib/use-admin-base";

export interface TeamFormData {
  name: string;
  role: string;
  photo_url: string | null;
  bio: string;
  linkedin_url: string;
  user_id: number | null;
  display_order: number | null; // null = place at the end (create only)
}

const EMPTY_FORM: TeamFormData = {
  name: "",
  role: "",
  photo_url: null,
  bio: "",
  linkedin_url: "",
  user_id: null,
  display_order: null,
};

const BIO_MAX = 1000;

interface TeamFormProps {
  mode: "create" | "edit";
  memberId?: number;
  initialData?: Partial<TeamFormData>;
}

export function TeamForm({ mode, memberId, initialData }: TeamFormProps) {
  const router = useRouter();
  const adminBase = useAdminBase();
  const [form, setForm] = useState<TeamFormData>({ ...EMPTY_FORM, ...initialData });
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof TeamFormData>(key: K, value: TeamFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Optional dropdown — if it can't load, the form still works without it.
  useEffect(() => {
    fetch("/api/admin/team/user-options")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setUsers([]));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const url = mode === "create" ? "/api/admin/team" : `/api/admin/team/${memberId}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          // null display_order = let the server append to the end
          display_order: form.display_order ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const firstIssue = data.issues ? Object.values(data.issues as Record<string, string[]>).flat()[0] : null;
        setError(firstIssue ?? data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }

      router.push(`${adminBase}/team`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-5 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Basic Information">
            <Field label="Full Name" required>
              <input
                required
                maxLength={100}
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={inputClass}
                placeholder="Abu Bakar"
              />
            </Field>
            <Field label="Role / Job Title">
              <input
                maxLength={100}
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
                className={inputClass}
                placeholder="Founder & WordPress Developer"
              />
            </Field>
            <Field label="Bio" hint={`${form.bio.length}/${BIO_MAX} characters · plain text, blank line = new paragraph`}>
              <textarea
                rows={5}
                maxLength={BIO_MAX}
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
                className={inputClass}
                placeholder="A short introduction shown on the team card."
              />
            </Field>
            <Field label="LinkedIn URL">
              <input
                type="url"
                maxLength={255}
                value={form.linkedin_url}
                onChange={(e) => update("linkedin_url", e.target.value)}
                className={inputClass}
                placeholder="https://www.linkedin.com/in/…"
              />
            </Field>
          </Section>

          <Section title="Account & Ordering">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Linked CMS user" hint="Optional — connects this card to a login account">
                <select
                  value={form.user_id ?? ""}
                  onChange={(e) => update("user_id", e.target.value ? Number(e.target.value) : null)}
                  className={inputClass}
                >
                  <option value="">Not linked</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Display Order"
                hint={mode === "create" ? "Leave empty to add at the end" : "Lower numbers appear first"}
              >
                <input
                  type="number"
                  min={0}
                  value={form.display_order ?? ""}
                  onChange={(e) => update("display_order", e.target.value === "" ? null : Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            </div>
          </Section>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Add Member" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`${adminBase}/team`)}
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <Section title="Photo">
            <ImageUploader aspect={1} cropTitle="Crop team photo" value={form.photo_url} onChange={(url) => update("photo_url", url)} />
          </Section>

          <div className="sticky top-[calc(var(--topbar-h,88px)+16px)]">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Live Preview</p>
            <PreviewCard form={form} />
          </div>
        </div>
      </div>
    </form>
  );
}

function PreviewCard({ form }: { form: TeamFormData }) {
  const initials = form.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

  return (
    <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
      <div className="relative mx-auto mb-3 h-24 w-24 overflow-hidden rounded-full border border-border bg-crimson-light">
        {form.photo_url ? (
          <Image src={form.photo_url} alt="" fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xl font-bold text-crimson">
            {initials || "?"}
          </div>
        )}
      </div>
      <h3 className="text-base font-bold text-foreground">
        {form.name || <span className="text-muted">Full name…</span>}
      </h3>
      <p className="mt-0.5 text-sm font-medium text-crimson">{form.role || <span className="text-muted">Role…</span>}</p>
      <p className="mt-2 whitespace-pre-line text-xs text-foreground/80">
        {form.bio || <span className="text-muted">Bio preview…</span>}
      </p>
      {form.linkedin_url && (
        <p className="mt-3 flex items-center justify-center gap-1 text-xs text-muted">
          <Link2 className="h-3 w-3" /> LinkedIn
        </p>
      )}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-crimson";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-foreground">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-crimson">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
