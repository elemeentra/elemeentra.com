import type { CountryRow } from "@/lib/analytics";

// Minimal country name map for top expected codes
const NAMES: Record<string, string> = {
  US:"United States", GB:"United Kingdom", CA:"Canada", AU:"Australia",
  PK:"Pakistan", IN:"India", DE:"Germany", FR:"France", AE:"UAE",
  SA:"Saudi Arabia", BD:"Bangladesh", NG:"Nigeria", ZA:"South Africa",
  NL:"Netherlands", SE:"Sweden", NO:"Norway", DK:"Denmark",
  SG:"Singapore", MY:"Malaysia", PH:"Philippines", ID:"Indonesia",
};

export function CountryTable({ rows }: { rows: CountryRow[] }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-muted">No country data yet.</p>;
  const max = rows[0].views;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.country_code} className="flex items-center gap-3 text-sm">
          <span className="w-6 text-base" title={r.country_code}>
            {/* flag emoji from code points */}
            {r.country_code.toUpperCase().replace(/./g, (c) =>
              String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0))
            )}
          </span>
          <span className="flex-1 truncate text-foreground">
            {NAMES[r.country_code] ?? r.country_code}
          </span>
          <div className="w-20">
            <div className="h-1.5 rounded-full bg-surface">
              <div className="h-1.5 rounded-full bg-crimson" style={{ width: `${(r.views / max) * 100}%` }} />
            </div>
          </div>
          <span className="w-10 text-right font-mono text-xs text-muted">{r.views.toLocaleString()}</span>
        </li>
      ))}
    </ul>
  );
}
