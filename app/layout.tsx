import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SessionProvider } from "next-auth/react";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — Open-Source ERP for Textile Businesses`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    "ERP",
    "textile",
    "open-source",
    "self-hosted",
    "bookkeeping",
    "inventory",
    "GST",
    "vouchers",
    "accounting",
    "Tally alternative",
    "double-entry accounting",
  ],
  authors: [{ name: APP_NAME }],
  creator: APP_NAME,
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: `${APP_NAME} — Open-Source ERP for Textile Businesses`,
    description:
      "Self-hosted, open-source ERP built for textile businesses. Tally-standard voucher engine, inventory, GST reports, and more.",
    siteName: APP_NAME,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `${APP_NAME} — Open-Source ERP for Textile Businesses`,
    description: "Self-hosted, open-source ERP built for textile businesses.",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: APP_NAME,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Linux, Windows, macOS, Docker",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  description: APP_DESCRIPTION,
  license: "https://opensource.org/licenses/MIT",
  softwareVersion: "0.1.1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
