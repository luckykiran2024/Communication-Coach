import type { Metadata, Viewport } from "next";
import { brand } from "@coach/core";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0b0f19",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://communicationcoach.vercel.app"),
  title: `${brand.name} | From Thought to Impact`,
  description: "Private, voice-first communication coaching. Practice 20 minutes a day and build real speaking confidence across daily work, business management, and executive leadership.",
  keywords: [
    "communication coach",
    "voice coaching",
    "public speaking",
    "management communication",
    "executive presence",
    "AI voice coach",
    "business communication",
  ],
  authors: [{ name: "Communication Coach Team" }],
  openGraph: {
    title: `${brand.name} · Practice 20 minutes a day`,
    description: "Personalized voice-first professional communication development engine for Android, iOS and Web.",
    url: "https://communicationcoach.vercel.app",
    siteName: brand.name,
    type: "website",
    images: [
      {
        url: "/app-mockup.jpg",
        width: 1080,
        height: 1920,
        alt: "Communication Coach Mobile App Interface",
      },
    ],
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
