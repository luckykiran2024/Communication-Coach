import type { Metadata } from "next";
import { brand } from "@coach/core";
import "./globals.css";
export const metadata: Metadata = { title: brand.name + " · Learning workspace", description: brand.tagline };
export default function Layout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
