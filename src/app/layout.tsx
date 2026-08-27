import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// PRD §2 — Font: Inter (headings bold/black weight, body regular)
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Elemeentra — Web Design, Development & Digital Growth",
    template: "%s | Elemeentra",
  },
  description:
    "Elemeentra builds, optimizes, and scales WordPress websites, Elementor designs, and WooCommerce stores for growing businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
