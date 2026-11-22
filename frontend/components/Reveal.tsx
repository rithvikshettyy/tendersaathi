"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades/slides children in once when scrolled into view.
 * Content is visible by default (SSR, no-JS, print). Only sections that start below the
 * fold are hidden after mount, then revealed on intersect.
 */
export default function Reveal({ children, delay = 0, className = "" }: {
  children: ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pre, setPre] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return; // already on screen
    setPre(true);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`rv ${pre && !shown ? "pre" : ""} ${shown ? "in" : ""} ${className}`}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}>
      {children}
    </div>
  );
}
