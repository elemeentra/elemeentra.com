"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { ICON_MAP, ICON_NAMES, resolveIcon } from "@/lib/icon-map";

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [filter, setFilter] = useState("");
  const ResolvedIcon = resolveIcon(value);

  const visibleNames = filter
    ? ICON_NAMES.filter((n) => n.toLowerCase().includes(filter.toLowerCase()))
    : ICON_NAMES;

  return (
    <div>
      <div className="mb-2.5 flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface">
          <ResolvedIcon className="h-5 w-5 text-crimson" />
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search icons…"
            className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm text-foreground outline-none focus:border-crimson"
          />
        </div>
      </div>

      <div className="grid max-h-40 grid-cols-8 gap-1.5 overflow-y-auto rounded-lg border border-border bg-background p-2">
        {visibleNames.map((name) => {
          const Icon = ICON_MAP[name];
          const active = value === name;
          return (
            <button
              key={name}
              type="button"
              title={name}
              onClick={() => onChange(name)}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                active
                  ? "border-crimson bg-crimson-light text-crimson"
                  : "border-transparent text-muted hover:border-border hover:bg-surface hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
        {visibleNames.length === 0 && (
          <p className="col-span-8 py-3 text-center text-xs text-muted">No icons match &quot;{filter}&quot;</p>
        )}
      </div>
    </div>
  );
}
