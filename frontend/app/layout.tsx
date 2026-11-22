import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n";

// Open-licence fallback for machines without Helvetica Neue (e.g. Windows).
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

// viewport-fit=cover lets the app use iPhone safe areas (notch / home bar) via env(safe-area-inset-*).
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "TenderSaathi",
  description: "Tender discovery, eligibility analysis and bid readiness for Indian manufacturers",
};

// Runs before first paint so the page never flashes the wrong theme.
// Uses the saved choice, otherwise the operating system's light/dark setting.
const THEME_INIT = `try{var t=localStorage.getItem("ts_theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME_INIT }} /></head>
      <body><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
