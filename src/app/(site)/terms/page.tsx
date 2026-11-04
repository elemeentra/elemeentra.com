import type { Metadata } from "next";

export const metadata: Metadata = { title: "Terms of Service", description: "Terms for using the Elemeentra website." };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-black text-foreground md:text-4xl">Terms of Service</h1>
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
        <p>By using this website you agree to these terms.</p>
        <h2 className="text-lg font-bold text-foreground">Use of the site</h2>
        <p>You agree not to misuse the site, attempt unauthorised access, or submit unlawful, abusive or spam content through our forms.</p>
        <h2 className="text-lg font-bold text-foreground">Content</h2>
        <p>All content on this site belongs to Elemeentra unless stated otherwise. Comments and reviews are moderated and may be removed at our discretion.</p>
        <h2 className="text-lg font-bold text-foreground">Services</h2>
        <p>Project scope, pricing and delivery are agreed in writing before work starts. Information on this site is not a binding offer.</p>
        <h2 className="text-lg font-bold text-foreground">Liability</h2>
        <p>The site is provided as is. To the extent permitted by law, we are not liable for losses arising from its use.</p>
        <p className="text-xs">This is a general template — have it reviewed against the laws that apply to your business before relying on it.</p>
      </div>
    </main>
  );
}
