import { useEffect, useState } from "react";
import "./exitPill.css";

/**
 * Floating exit pill for "bare" screens (BARE_TABS) — replaces the global
 * back header + topbar. The title fades in once the user scrolls, iOS-style.
 */
export default function ExitPill({ title, onBack, right }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="x-fabrow">
      <button className="x-exitfab" onClick={onBack || (() => {})} aria-label="Back">← Back</button>
      {title && <span className={`x-fabtitle${scrolled ? " in" : ""}`}>{title}</span>}
      {right}
    </div>
  );
}
