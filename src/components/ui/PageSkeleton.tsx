/** Generic instant placeholder shown while a route's server data is loading. */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-md bg-border" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 rounded-xl bg-border/70" />)}
      </div>
      <div className="rounded-xl border border-border bg-card p-4">
        {Array.from({ length: 6 }).map((_, i) => <div key={i} className="mb-3 h-8 rounded-md bg-border/60 last:mb-0" />)}
      </div>
    </div>
  );
}
