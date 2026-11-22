import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TenderSaathi",
  description: "Tender discovery, eligibility analysis and bid readiness for Indian manufacturers",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
