"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

interface Author {
  id: number;
  name: string;
  email: string;
  role?: string;
}

interface AuthorSelectorProps {
  value: number | null;
  onChange: (id: number | null) => void;
}

export function AuthorSelector({ value, onChange }: AuthorSelectorProps) {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAuthors = async () => {
      try {
        const res = await fetch("/api/admin/users/authors");
        const data = await res.json();
        setAuthors((data.users as Author[]) || []);
      } finally {
        setLoading(false);
      }
    };
    loadAuthors();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted" />
        <span className="text-xs text-muted">Loading authors…</span>
      </div>
    );
  }

  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-crimson"
    >
      <option value="">Select author…</option>
      {authors.map((author) => (
        <option key={author.id} value={author.id}>
          {author.name} ({author.email})
        </option>
      ))}
    </select>
  );
}
