import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { SessionProvider } from "next-auth/react";

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
    default: "Texora — Modern ERP for Textile Businesses",
    template: "%s · Texora",
  },
  description:
    "Texora is a modern cloud ERP for textile businesses — manage bookkeeping, inventory, GST, vouchers, and reports in one place.",
  keywords: ["ERP", "textile", "bookkeeping", "inventory", "GST", "vouchers", "accounting"],
  authors: [{ name: "Texora" }],
  creator: "Texora",
  metadataBase: new URL("https://texora.app"),
  openGraph: {
    title: "Texora — Modern ERP for Textile Businesses",
    description:
      "Cloud ERP built for textile businesses. Tally-standard voucher engine, inventory, GST reports, and more.",
    siteName: "Texora",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Texora — Modern ERP for Textile Businesses",
    description: "Cloud ERP built for textile businesses.",
  },
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
      <body className="min-h-full flex flex-col">
        <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
