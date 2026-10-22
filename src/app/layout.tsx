import type { Metadata, Viewport } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "UnNag — End household nagging",
  description:
    "Send tasks anytime. Your partner only gets them during quiet windows — with 5-second voice drops.",
  applicationName: "UnNag",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "UnNag",
  },
  openGraph: {
    title: "UnNag",
    description: "End nagging. Deliver household asks only in free windows.",
    url: "https://household-vault.vercel.app",
    siteName: "UnNag",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#12151A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-dvh bg-fog font-sans text-ink antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
