import { type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  value: number | string;
  sub?: string;
  growth?: number | null;
  icon: LucideIcon;
  href?: string;
  accent?: boolean;
}

export function StatCard({ label, value, sub, growth, icon: Icon, accent }: Props) {
  return (
    <div className={`rounded-2xl border bg-card p-5 shadow-sm ${accent ? "border-crimson/30" : "border-border"}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
          <p className="mt-1 text-3xl font-bold text-foreground">{value.toLocaleString()}</p>
          {sub && <p className="mt-0.5 truncate text-xs text-muted">{sub}</p>}
          {growth !== undefined && growth !== null && (
            <p className={`mt-1 text-xs font-medium ${growth >= 0 ? "text-green-600 dark:text-green-400" : "text-crimson"}`}>
              {growth >= 0 ? "▲" : "▼"} {Math.abs(growth)}% vs last month
            </p>
          )}
        </div>
        <div className={`ml-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${accent ? "bg-crimson text-white" : "bg-surface text-muted"}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
