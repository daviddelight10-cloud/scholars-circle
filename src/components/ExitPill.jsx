import { useEffect, useState } from "react";
import "./exitPill.css";

/**
 * Floating exit pill for "bare" screens (BARE_TABS) — replaces the global
 * back header + topbar. The compact title fades in once the user scrolls,
 * iOS-style. `large` renders a big silver heading under the pill that
 * dissolves as the page scrolls.
 */
export default function ExitPill({ title, onBack, right, large }) {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrolled = scrollY > 28;
  const fade = Math.max(0, 1 - scrollY / 56);

  return (
    <>
      <div className="x-fabrow">
        <button className="x-exitfab" onClick={onBack || (() => {})} aria-label="Back">← Back</button>
        {title && <span className={`x-fabtitle${scrolled ? " in" : ""}`}>{title}</span>}
        {right}
      </div>
      {large && title && (
        <h1 className="x-bigtitle" style={{ opacity: fade }}>{title}</h1>
      )}
    </>
  );
}
