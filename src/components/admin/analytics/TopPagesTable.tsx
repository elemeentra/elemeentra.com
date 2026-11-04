import type { PageViewRow } from "@/lib/analytics";

export function TopPagesTable({ rows }: { rows: PageViewRow[] }) {
  if (!rows.length) {
    return <p className="py-6 text-center text-sm text-muted">No page view data yet.</p>;
  }
  const max = rows[0].views;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="pb-2 pr-4 font-medium text-muted">Page</th>
            <th className="pb-2 text-right font-medium text-muted">Views</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.path} className="border-b border-border/50 last:border-0">
              <td className="py-2 pr-4">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 rounded-full bg-crimson/20 flex-1" style={{ maxWidth: 120 }}>
                    <div className="h-1.5 rounded-full bg-crimson" style={{ width: `${(r.views / max) * 100}%` }} />
                  </div>
                  <span className="truncate text-foreground max-w-[200px]" title={r.path}>{r.path}</span>
                </div>
              </td>
              <td className="py-2 text-right font-mono text-foreground">{r.views.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
