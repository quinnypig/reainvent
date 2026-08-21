import type { Metadata } from "next";
import catalog from "../public/data.json";
import "./globals.css";

const activeSessions = catalog.sessions;
const signalCount = activeSessions.filter((session) => session.pangram?.label === "AI" || session.pangram?.label === "Mixed").length;
const signalPercent = (signalCount / activeSessions.length * 100).toFixed(1);
const finding = `${signalPercent}% show an AI signal`;
const description = `Pangram flags ${signalCount.toLocaleString("en-US")} of ${activeSessions.length.toLocaleString("en-US")} AWS re:Invent 2026 session descriptions as AI or mixed.`;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://reainvent.com"),
  title: `re:AInvent catalog audit — ${finding}`,
  description,
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
  openGraph: {
    title: `${signalPercent}% of re:Invent descriptions show an AI signal`,
    description,
    images: [{ url: "/og-reainvent-v3.png", width: 1731, height: 909, alt: "AWS? re:AInvent — independent 2026 catalog audit" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `re:AInvent catalog audit — ${finding}`,
    description: "Every AWS re:Invent 2026 session description, scored by Pangram.",
    images: ["/og-reainvent-v3.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
