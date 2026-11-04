"use client";

export default function BlogPostError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-foreground mb-4">Post Not Found</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700 font-medium text-sm mb-2">Error:</p>
          <p className="text-red-600 text-xs font-mono break-all">
            {error.message}
          </p>
        </div>
        
        <div className="space-y-3">
          <a
            href="/blog"
            className="block px-6 py-2 bg-crimson text-white rounded-lg font-medium hover:bg-crimson-hover transition"
          >
            Back to Blog
          </a>
          <button
            onClick={reset}
            className="block w-full px-6 py-2 border border-border text-foreground rounded-lg font-medium hover:bg-surface transition"
          >
            Try Again
          </button>
        </div>
      </div>
    </main>
  );
}
