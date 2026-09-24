import type { Metadata } from "next";
import "./globals.css";

const description =
  "re:Sell — the conference seat exchange. Your next breakthrough. At market price.";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://reainvent.com",
  ),
  title: "re:Sell — Your next breakthrough. At market price.",
  description,
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "re:Sell — Learning has a new price discovery mechanism.",
    description,
    type: "website",
    images: [{ url: "/social.svg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary",
    title: "re:Sell — Your next breakthrough. At market price.",
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
