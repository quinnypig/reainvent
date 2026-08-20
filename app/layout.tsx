import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "85% AI — Catalog Watch for AWS re:Invent 2026",
  description: "Pangram flags 85% of AWS re:Invent 2026 session descriptions for AI involvement. See every score, addition, edit, and removal.",
  openGraph: {
    title: "AWS’s re:Invent catalog is 85% AI",
    description: "Every one of the 1,121 session descriptions, scored by Pangram—with the catalog history attached.",
    images: [{ url: "/og-ai.png", width: 1728, height: 912, alt: "Catalog Watch — AWS’s catalog is 85% AI" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AWS’s re:Invent catalog is 85% AI",
    description: "Every session description, scored by Pangram.",
    images: ["/og-ai.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${mono.variable} ${display.variable}`}>{children}</body></html>;
}
