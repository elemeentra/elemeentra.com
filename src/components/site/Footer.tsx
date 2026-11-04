import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { NewsletterForm } from "./NewsletterForm";
import { BrandLogo, type BrandProps } from "@/components/brand/BrandLogo";

interface Props {
  brand: BrandProps;
  tagline: string;
  email: string;
  phone: string;
  address: string;
}

export function Footer({ brand, tagline, email, phone, address }: Props) {
  const siteName = brand.siteName;
  return (
    <footer className="border-t border-border bg-surface pb-16 lg:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-3">
        <div>
          <Link href="/" aria-label={siteName} className="inline-flex text-foreground">
            <BrandLogo {...brand} size={40} textClassName="text-lg font-black text-foreground" />
          </Link>
          <p className="mt-2 max-w-xs text-sm text-muted">{tagline}</p>
          <ul className="mt-4 space-y-1.5 text-sm text-muted">
            {email && <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> <a href={`mailto:${email}`} className="hover:text-crimson">{email}</a></li>}
            {phone && <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> {phone}</li>}
            {address && <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> {address}</li>}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Explore</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            {[["/services", "Services"], ["/portfolio", "Portfolio"], ["/reviews", "Reviews"], ["/blog", "Blog"], ["/about", "About"], ["/contact", "Contact"], ["/privacy", "Privacy Policy"], ["/terms", "Terms"]].map(([h, l]) => (
              <li key={h}><Link href={h} className="hover:text-crimson">{l}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Newsletter</p>
          <p className="mb-3 mt-3 text-sm text-muted">Tips on WordPress, speed and growth. No spam.</p>
          <NewsletterForm />
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted">
        © {new Date().getFullYear()} {siteName}. All rights reserved.
        <span className="mx-2 opacity-40" aria-hidden="true">|</span>
        Security by{" "}
        <a
          href="https://sigintrecon.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-foreground underline-offset-2 transition hover:text-crimson hover:underline"
        >
          Sigintrecon
        </a>
      </div>
    </footer>
  );
}
