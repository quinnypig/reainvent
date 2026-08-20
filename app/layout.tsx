import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const display = Instrument_Serif({ variable: "--font-display", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: "Catalog Watch — AWS re:Invent 2026",
  description: "Every session AWS adds, edits, and removes from the re:Invent 2026 catalog.",
  openGraph: {
    title: "What changed at re:Invent?",
    description: "A living record of every session AWS adds, edits, and quietly pulls from the 2026 catalog.",
    images: [{ url: "/og.png", width: 1728, height: 912, alt: "Catalog Watch — What changed at re:Invent?" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "What changed at re:Invent?",
    description: "The live AWS re:Invent 2026 session index.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${sans.variable} ${mono.variable} ${display.variable}`}>{children}</body></html>;
}
