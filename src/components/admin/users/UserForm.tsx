"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff, Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { ImageUploader } from "@/components/admin/ImageUploader";
import { useAdminBase } from "@/lib/use-admin-base";

interface SocialLinkForm {
  platform_name: string;
  platform_url: string;
  icon_type: "preset" | "custom";
  custom_icon_url: string | null;
}

export interface UserFormData {
  name: string;
  email: string;
  password: string;
  role_id: number | null;
  status: "active" | "inactive";
  custom_service: string;
  profile_photo: string | null;
  bio: string;
  social_links: SocialLinkForm[];
}

const EMPTY_FORM: UserFormData = {
  name: "",
  email: "",
  password: "",
  role_id: null,
  status: "active",
  custom_service: "",
  profile_photo: null,
  bio: "",
  social_links: [],
};

const BIO_MAX = 1000;
const MAX_LINKS = 12;
const PRESET_PLATFORMS = ["LinkedIn", "GitHub", "X (Twitter)", "Facebook", "Instagram", "YouTube", "Dribbble", "Behance"];

interface UserFormProps {
  mode: "create" | "edit";
  userId?: number;
  isSelf?: boolean;
  initialData?: Partial<UserFormData>;
}

/** 14 chars from an unambiguous alphabet, guaranteed to contain a letter and a digit. */
function generatePassword(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const all = letters + digits + "!@#$%";
  const bytes = crypto.getRandomValues(new Uint32Array(14));
  const chars = Array.from(bytes, (b) => all[b % all.length]);
  chars[0] = letters[bytes[0] % letters.length];
  chars[1] = digits[bytes[1] % digits.length];
  return chars.join("");
}

export function UserForm({ mode, userId, isSelf, initialData }: UserFormProps) {
  const router = useRouter();
  const adminBase = useAdminBase();
  const [form, setForm] = useState<UserFormData>({ ...EMPTY_FORM, ...initialData });
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof UserFormData>(key: K, value: UserFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    fetch("/api/admin/roles")
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => {
        const items = (data.items ?? []) as { id: number; name: string }[];
        setRoles(items);
        // Default new users to the least-privileged system role, never Super Admin.
        if (mode === "create") {
          const fallback = items.find((r) => r.name === "Contributor") ?? items.find((r) => r.name !== "Super Admin");
          setForm((prev) => (prev.role_id === null && fallback ? { ...prev, role_id: fallback.id } : prev));
        }
      })
      .catch(() => setRoles([]));
  }, [mode]);

  function updateLink(index: number, patch: Partial<SocialLinkForm>) {
    setForm((prev) => ({
      ...prev,
      social_links: prev.social_links.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.role_id === null) {
      setError("Please choose a role.");
      return;
    }
    setSaving(true);

    try {
      const res = await fetch(mode === "create" ? "/api/admin/users" : `/api/admin/users/${userId}`, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const firstIssue = data.issues ? Object.values(data.issues as Record<string, string[]>).flat()[0] : null;
        setError(firstIssue ?? data.error ?? "Something went wrong.");
        setSaving(false);
        return;
      }

      router.push(`${adminBase}/users`);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setSaving(false);
    }
  }

  const roleName = roles.find((r) => r.id === form.role_id)?.name;

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="mb-5 rounded-lg border border-crimson/30 bg-crimson-light px-3 py-2 text-sm text-crimson">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Section title="Account">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full Name" required>
                <input
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Email" required>
                <input
                  required
                  type="email"
                  maxLength={150}
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field
              label={mode === "create" ? "Password" : "New Password"}
              required={mode === "create"}
              hint={
                mode === "create"
                  ? "8–72 characters with at least one letter and one number."
                  : "Leave empty to keep the current password. Setting one also clears any lockout."
              }
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    required={mode === "create"}
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    maxLength={72}
                    value={form.password}
                    onChange={(e) => update("password", e.target.value)}
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    update("password", generatePassword());
                    setShowPassword(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-foreground transition hover:bg-surface"
                >
                  <Wand2 className="h-4 w-4" />
                  Generate
                </button>
              </div>
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Role" required hint={isSelf ? "You can't change your own role." : undefined}>
                <select
                  required
                  disabled={isSelf}
                  value={form.role_id ?? ""}
                  onChange={(e) => update("role_id", e.target.value ? Number(e.target.value) : null)}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="">Select a role…</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status" hint={isSelf ? "You can't deactivate your own account." : undefined}>
                <select
                  disabled={isSelf}
                  value={form.status}
                  onChange={(e) => update("status", e.target.value as "active" | "inactive")}
                  className={`${inputClass} disabled:opacity-60`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive (can&apos;t sign in)</option>
                </select>
              </Field>
            </div>
          </Section>

          <Section title="Profile">
            <Field label="Custom Service / Specialty" hint="Optional — e.g. WooCommerce Development">
              <input
                maxLength={150}
                value={form.custom_service}
                onChange={(e) => update("custom_service", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Bio" hint={`${form.bio.length}/${BIO_MAX} characters · plain text, blank line = new paragraph`}>
              <textarea
                rows={4}
                maxLength={BIO_MAX}
                value={form.bio}
                onChange={(e) => update("bio", e.target.value)}
                className={inputClass}
              />
            </Field>
          </Section>

          <Section title="Social Links">
            {form.social_links.length === 0 && <p className="text-sm text-muted">No social links added.</p>}
            {form.social_links.map((link, i) => (
              <div key={i} className="rounded-xl border border-border bg-background p-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-[170px_1fr_auto]">
                  <div>
                    <input
                      list="preset-platforms"
                      maxLength={100}
                      placeholder="Platform"
                      value={link.platform_name}
                      onChange={(e) => updateLink(i, { platform_name: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <input
                    type="url"
                    maxLength={255}
                    placeholder="https://…"
                    value={link.platform_url}
                    onChange={(e) => updateLink(i, { platform_url: e.target.value })}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => update("social_links", form.social_links.filter((_, idx) => idx !== i))}
                    aria-label="Remove link"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted transition hover:border-crimson hover:text-crimson"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-foreground">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={link.icon_type === "preset"}
                      onChange={() => updateLink(i, { icon_type: "preset" })}
                      className="accent-crimson"
                    />
                    Preset icon
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      checked={link.icon_type === "custom"}
                      onChange={() => updateLink(i, { icon_type: "custom" })}
                      className="accent-crimson"
                    />
                    Custom icon
                  </label>
                </div>
                {link.icon_type === "custom" && (
                  <div className="mt-3 max-w-[160px]">
                    <ImageUploader aspect={1} value={link.custom_icon_url} onChange={(url) => updateLink(i, { custom_icon_url: url })} />
                  </div>
                )}
              </div>
            ))}
            <datalist id="preset-platforms">
              {PRESET_PLATFORMS.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            <button
              type="button"
              disabled={form.social_links.length >= MAX_LINKS}
              onClick={() =>
                update("social_links", [
                  ...form.social_links,
                  { platform_name: "", platform_url: "", icon_type: "preset", custom_icon_url: null },
                ])
              }
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground transition hover:bg-surface disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add link
            </button>
          </Section>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-crimson px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-crimson-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Create User" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={() => router.push(`${adminBase}/users`)}
              className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium text-foreground transition hover:bg-surface"
            >
              Cancel
            </button>
          </div>
        </div>

        <div className="space-y-6 lg:col-span-1">
          <Section title="Profile Photo">
            <ImageUploader round cropTitle="Crop profile photo" value={form.profile_photo} onChange={(url) => update("profile_photo", url)} />
          </Section>

          <div className="sticky top-[calc(var(--topbar-h,88px)+16px)]">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
            <div className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
              <div className="relative mx-auto mb-3 h-20 w-20 overflow-hidden rounded-full border border-border bg-crimson-light">
                {form.profile_photo ? (
                  <Image src={form.profile_photo} alt="" fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xl font-bold text-crimson">
                    {form.name.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
              </div>
              <p className="font-bold text-foreground">{form.name || <span className="text-muted">Full name…</span>}</p>
              <p className="text-xs text-muted">{form.email || "email@example.com"}</p>
              {roleName && (
                <span className="mt-2 inline-flex rounded-full bg-crimson-light px-2.5 py-0.5 text-xs font-medium text-crimson">
                  {roleName}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
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
