import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Open-licence fallback for machines without Helvetica Neue (e.g. Windows).
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "TenderSaathi",
  description: "Tender discovery, eligibility analysis and bid readiness for Indian manufacturers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
