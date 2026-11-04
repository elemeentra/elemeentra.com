"use client";

import { useEffect, useState, type FormEvent } from "react";

/**
 * Shared state for the two settings forms. Saves with PATCH and sends only
 * the fields that changed, so one form can never overwrite a value it
 * didn't touch. The server's response becomes the new saved baseline.
 */
export function useSettingsForm<T extends object>(endpoint: string, initial: T) {
  const [saved, setSaved] = useState<T>(initial);
  const [form, setForm] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const keys = Object.keys(initial) as (keyof T & string)[];
  const changedKeys = keys.filter((k) => form[k] !== saved[k]);
  const dirty = changedKeys.length > 0;

  // Leaving with unsaved edits is almost always a mistake on a settings page.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function update<K extends keyof T>(key: K, value: T[K]) {
    setJustSaved(false);
    setFieldErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function discard() {
    setForm(saved);
    setError(null);
    setFieldErrors({});
    setJustSaved(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!dirty) return;
    setError(null);
    setFieldErrors({});
    setJustSaved(false);
    setSaving(true);

    try {
      const body = Object.fromEntries(changedKeys.map((k) => [k, form[k]]));
      const res = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const issues = (data.issues ?? {}) as Record<string, string[]>;
        const perField: Record<string, string> = {};
        for (const [k, msgs] of Object.entries(issues)) {
          if (k !== "_form" && msgs?.[0]) perField[k] = msgs[0];
        }
        setFieldErrors(perField);
        setError(
          Object.keys(perField).length > 0
            ? "Please fix the highlighted fields."
            : issues._form?.[0] ?? data.error ?? "Something went wrong."
        );
        return;
      }

      setSaved(data.values as T);
      setForm(data.values as T);
      setJustSaved(true);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return { form, update, dirty, saving, error, justSaved, fieldErrors, discard, submit };
}
