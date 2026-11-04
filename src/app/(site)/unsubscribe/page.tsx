import type { Metadata } from "next";
import { UnsubscribeButton } from "@/components/site/UnsubscribeButton";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default function UnsubscribePage({ searchParams }: { searchParams: { token?: string } }) {
  const token = searchParams.token ?? "";
  return (
    <main className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="text-2xl font-black text-foreground">Unsubscribe</h1>
      {/^[a-f0-9]{16,128}$/i.test(token) ? (
        <>
          <p className="mt-2 text-sm text-muted">Click below to stop receiving our newsletter.</p>
          <UnsubscribeButton token={token} />
        </>
      ) : (
        <p className="mt-2 text-sm text-muted">This unsubscribe link is invalid or incomplete.</p>
      )}
    </main>
  );
}
