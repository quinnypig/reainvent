import type { Metadata } from "next";
import "./globals.css";

const description =
  "reAInvent — use AI to help subsidize your conference trip. Explore session demand, price seats, and plan your travel fund.";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://reainvent.com",
  ),
  title: "reAInvent — Put AI on the travel budget.",
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "reAInvent — Put AI on the travel budget.",
    description,
    type: "website",
    images: [{ url: "/social.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: "reAInvent — Put AI on the travel budget.",
    description,
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
