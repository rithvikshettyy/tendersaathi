"use client";
import { AuthGate } from "@/lib/auth";

export default function FlowLayout({ children }: { children: React.ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
