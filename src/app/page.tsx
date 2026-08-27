export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-crimson text-xl font-black text-white">
        E
      </div>
      <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
        We Build, Optimize &amp; Grow{" "}
        <span className="text-crimson">Your Online Presence.</span>
      </h1>
      <p className="mt-4 max-w-md text-sm text-muted">
        Elemeentra&apos;s new site is under active development. The public pages
        (Hero, Services, Portfolio, Blog) ship in the next build phases —
        Phase 1 (this build) covers the database, authentication, and Admin
        Panel foundation.
      </p>
    </main>
  );
}
