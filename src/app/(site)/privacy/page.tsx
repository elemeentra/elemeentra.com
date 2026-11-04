import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Elemeentra handles your personal data." };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-black text-foreground md:text-4xl">Privacy Policy</h1>
      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
        <p>We collect only what we need to respond to you and to improve this website.</p>
        <h2 className="text-lg font-bold text-foreground">Information you give us</h2>
        <p>When you use our contact, review, comment or newsletter forms, we store the details you submit (such as your name, email address and message) so we can reply, moderate content or send updates you asked for.</p>
        <h2 className="text-lg font-bold text-foreground">Analytics</h2>
        <p>We record anonymous page views (page path, referring domain, country and device type). We do not use tracking cookies and do not store IP addresses in our analytics.</p>
        <h2 className="text-lg font-bold text-foreground">Newsletter</h2>
        <p>You can unsubscribe at any time using the unsubscribe link in our emails.</p>
        <h2 className="text-lg font-bold text-foreground">Your rights</h2>
        <p>You can ask us to access, correct or delete your data by contacting us through the contact page.</p>
        <p className="text-xs">This is a general template — have it reviewed against the laws that apply to your business before relying on it.</p>
      </div>
    </main>
  );
}
