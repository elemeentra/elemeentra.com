"use client";

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-foreground mb-4">Error</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-medium text-sm mb-2">Database Error:</p>
          <p className="text-red-600 text-xs font-mono break-all">
            {error.message}
          </p>
        </div>
        
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <p className="text-amber-700 text-sm">
            <strong>Troubleshooting:</strong>
          </p>
          <ul className="text-amber-600 text-xs text-left mt-2 space-y-1">
            <li>✓ Check your database connection in <code>.env.local</code></li>
            <li>✓ Verify the blog tables are migrated: <code>npm run db:migrate</code></li>
            <li>✓ Test with XAMPP MySQL (local) instead of Hostinger (remote)</li>
            <li>✓ Check firewall/network access to database host</li>
          </ul>
        </div>

        <button
          onClick={reset}
          className="px-6 py-2 bg-crimson text-white rounded-lg font-medium hover:bg-crimson-hover transition"
        >
          Try Again
        </button>
      </div>
    </main>
  );
}
