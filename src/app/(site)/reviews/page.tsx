import type { Metadata } from "next";
import { Star } from "lucide-react";
import { ReviewForm } from "@/components/site/ReviewForm";
import { JsonLd, siteUrl } from "@/components/site/JsonLd";
import { getApprovedReviews, getReviewStats } from "@/lib/site-data";

export const metadata: Metadata = {
  title: "Client Reviews",
  description: "What clients say about working with Elemeentra.",
};

export default async function ReviewsPage() {
  const [reviews, stats] = await Promise.all([
    getApprovedReviews(50).catch(() => []),
    getReviewStats().catch(() => ({ count: 0, average: 0 })),
  ]);

  return (
    <main>
      {stats.count > 0 && (
        <JsonLd data={{
          "@context": "https://schema.org", "@type": "Organization", name: "Elemeentra", url: siteUrl(),
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: stats.average.toFixed(1), reviewCount: stats.count, bestRating: 5, worstRating: 1,
          },
        }} />
      )}
      <section className="border-b border-border bg-surface py-16 md:py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h1 className="text-4xl font-black text-foreground md:text-5xl">Client Reviews</h1>
          {stats.count > 0 && (
            <p className="mt-3 flex items-center gap-2 text-lg text-muted">
              <Star className="h-5 w-5 fill-crimson text-crimson" />
              <span className="font-semibold text-foreground">{stats.average.toFixed(1)}</span> from {stats.count} review{stats.count > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-14 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          {reviews.length === 0 && <p className="text-muted">No reviews yet — be the first!</p>}
          {reviews.map((r) => (
            <figure key={r.id} className="rounded-2xl border border-border bg-card p-6">
              <div className="mb-2 flex gap-0.5" aria-label={`${r.rating} out of 5 stars`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-crimson text-crimson" : "text-border"}`} />
                ))}
              </div>
              {r.review_title && <p className="font-semibold text-foreground">{r.review_title}</p>}
              {r.review_text && <blockquote className="mt-1 whitespace-pre-line text-sm text-muted">{r.review_text}</blockquote>}
              <figcaption className="mt-3 text-xs font-medium text-foreground">— {r.name}</figcaption>
            </figure>
          ))}
        </div>
        <div className="lg:col-span-2"><ReviewForm /></div>
      </section>
    </main>
  );
}
