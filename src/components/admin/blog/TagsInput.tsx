"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

interface Tag {
  id: number;
  name: string;
}

interface TagsInputProps {
  value: number[];
  onChange: (ids: number[]) => void;
}

export function TagsInput({ value, onChange }: TagsInputProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const [creating, setCreating] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/tags")
      .then((res) => res.json())
      .then((data) => setAllTags(data.tags || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleTag(id: number) {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  }

  async function createAndSelectTag(name: string) {
    setCreating(true);
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        const newTag: Tag = data.tag ?? { id: data.id, name };
        setAllTags((prev) => (prev.some((t) => t.id === newTag.id) ? prev : [...prev, newTag]));
        toggleTag(newTag.id);
        setSearch("");
      }
    } finally {
      setCreating(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || !search.trim()) return;
    e.preventDefault();

    const query = search.trim().toLowerCase();
    const existing = allTags.find((t) => t.name.toLowerCase() === query);
    if (existing) {
      toggleTag(existing.id);
      setSearch("");
    } else {
      createAndSelectTag(search.trim());
    }
  }

  const selectedTags = allTags.filter((t) => value.includes(t.id));
  const suggestions = search.trim()
    ? allTags.filter((t) => !value.includes(t.id) && t.name.toLowerCase().includes(search.trim().toLowerCase()))
    : [];

  return (
    <div ref={wrapperRef}>
      {selectedTags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-crimson-light px-3 py-1.5 text-xs font-medium text-crimson"
            >
              {tag.name}
              <button type="button" onClick={() => toggleTag(tag.id)} className="hover:text-crimson-hover">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          disabled={creating}
          placeholder="Add tag, press Enter"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson focus:ring-1 focus:ring-crimson/20"
        />

        {focused && suggestions.length > 0 && (
          <div className="absolute top-full z-10 mt-1 w-full rounded-md border border-border bg-card p-1 shadow-lg max-h-40 overflow-y-auto">
            {suggestions.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault(); // keep focus so click registers before blur closes the list
                  toggleTag(tag.id);
                  setSearch("");
                }}
                className="w-full rounded-md px-2 py-1.5 text-left text-xs text-foreground transition hover:bg-surface"
              >
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
