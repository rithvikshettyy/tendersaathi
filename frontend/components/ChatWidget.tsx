"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import ChatPanel, { type ChatPanelHandle } from "./ChatPanel";

/** Floating chat button + popup. Stays mounted so the conversation survives page changes. */
export default function ChatWidget() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<ChatPanelHandle>(null);

  useEffect(() => { if (open) panel.current?.focus(); }, [open]);
  useEffect(() => {
    const openChat = () => setOpen(true);
    window.addEventListener("ts:open-chat", openChat);
    return () => window.removeEventListener("ts:open-chat", openChat);
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (path.startsWith("/chat")) return null; // the full Chat page is already open

  return (
    <>
      <section className="chatwin" hidden={!open} role="dialog" aria-label="Chat with TenderSaathi">
        <header>
          <b>Ask TenderSaathi</b>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close chat">✕</button>
        </header>
        <ChatPanel ref={panel} compact />
      </section>
      <button type="button" className="fab" onClick={() => setOpen(o => !o)} aria-expanded={open} aria-label={open ? "Close chat" : "Open chat"}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z" /></svg>
        <span>{open ? "Close" : "Chat"}</span>
      </button>
    </>
  );
}
