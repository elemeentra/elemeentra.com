import { Mail } from "lucide-react";
import type { RecentContactRow } from "@/lib/analytics";

export function RecentContactsList({ rows }: { rows: RecentContactRow[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No contacts yet.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 py-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">
              {r.name}
              {!r.is_read && (
                <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-crimson align-middle" />
              )}
            </p>
            <p className="truncate text-xs text-muted">{r.service_interested ?? r.email}</p>
          </div>
          <time className="shrink-0 text-xs text-muted">
            {new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </time>
        </li>
      ))}
    </ul>
  );
}
