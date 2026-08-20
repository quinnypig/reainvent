import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://reainvent.com"),
  title: "AWS re:AInvent — 85% AI",
  description: "An unofficial re:Invent catalog audit. Pangram flags 85% of AWS’s 2026 session descriptions for AI involvement.",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
  openGraph: {
    title: "AWS re:AInvent — Prompt what’s next",
    description: "Pangram flags 85% of the 1,121 re:Invent session descriptions for AI involvement.",
    images: [{ url: "/og-reainvent.png", width: 1728, height: 912, alt: "AWS? re:AInvent — Prompt what’s next. 85% AI" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AWS re:AInvent — 85% AI",
    description: "Prompt what’s next. Every session description, scored by Pangram.",
    images: ["/og-reainvent.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${mono.variable}`}>{children}</body></html>;
}
