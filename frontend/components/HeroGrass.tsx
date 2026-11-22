"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "./ThemeToggle";

const GrassField = dynamic(() => import("@/components/originkit/ui/grass-field"), { ssr: false });

/**
 * WebGL grass field behind the hero. Only mounted while the hero is on screen
 * (stops the render loop when scrolled away), lighter on small screens, and
 * skipped entirely for reduced-motion users.
 */
export default function HeroGrass() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [density, setDensity] = useState(80);
  const theme = useTheme();
  const colors = theme === "dark"
    ? { background: "#1A1919", horizon: "#6E1E3B", bladeBase: "#1A1919", bladeTip: "#E8DFD0" }
    : { background: "#E8DFD0", horizon: "#C9A3B2", bladeBase: "#E8DFD0", bladeTip: "#6E1E3B" };

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setDensity(window.innerWidth < 768 ? 35 : 80);
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="hero-bg" aria-hidden="true">
      {on && (
        <GrassField
          density={density}
          style={{ minWidth: 0, minHeight: 0 }}
          {...colors}
        />
      )}
    </div>
  );
}
