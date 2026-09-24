import type { Metadata } from "next";
import "./globals.css";

const description =
  "reAInvent — a marketplace for re:Invent session reservations. Explore buyer quotes and see how AI-assisted reservation resale could help cover your trip.";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://reainvent.com",
  ),
  title: "reAInvent — Buy and sell session reservations.",
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "reAInvent — Buy and sell session reservations.",
    description,
    type: "website",
    images: [{ url: "/social.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: "reAInvent — Buy and sell session reservations.",
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
