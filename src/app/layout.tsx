import type { Metadata } from "next";
import { Suspense } from "react";
import { NavProgress } from "@/components/ui/NavProgress";
import { Inter } from "next/font/google";
import { getBrand } from "@/lib/branding";
import "./globals.css";

// PRD §2 — Font: Inter (headings bold/black weight, body regular)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const BASE_METADATA: Metadata = {
  title: {
    default: "Elemeentra — Web Design, Development & Digital Growth",
    template: "%s | Elemeentra",
  },
  description:
    "Elemeentra builds, optimizes, and scales WordPress websites, Elementor designs, and WooCommerce stores for growing businesses.",
};

// Favicon follows Settings → General (favicon, else the logo, else the built-in E mark).
export async function generateMetadata(): Promise<Metadata> {
  const { favicon, logoUrl } = await getBrand();
  const icon = favicon || logoUrl || "/brand/favicon-64.png";
  return { ...BASE_METADATA, icons: { icon, shortcut: icon, apple: favicon || logoUrl || "/brand/logo-192.png" } };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Suspense fallback={null}>
          <NavProgress />
        </Suspense>
        {children}
      </body>
    </html>
  );
}
