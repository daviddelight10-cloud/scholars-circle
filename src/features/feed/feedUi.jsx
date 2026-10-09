import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
// These primitives are used outside the Feed too (roadmap topic page,
// sheets) — the chunk must carry its own styles or portaled overlays
// render as unstyled divs when feed.css hasn't loaded.
import "../../feed.css";

/* ─── Portaled overlay primitives ─────────────────────────────────────
   Feed overlays used to render inside .fd-root (isolation: isolate), so
   they stacked UNDER the app topbar/mobile nav (z-100). FdPortal puts
   them on document.body — above nav, below global modals/toasts. The
   .fd-portal wrapper re-declares the fd-* palette so portaled content
   keeps the feed's theme. */

export function FdPortal({ children }) {
  return createPortal(<div className="fd-portal">{children}</div>, document.body);
}

// Esc close + body scroll lock, shared by sheet & screen.
// Stack so Esc only dismisses the TOPMOST overlay (e.g. a picker opened
// from inside Go Live must not also close Go Live behind it).
const overlayStack = [];
function useOverlayChrome(onClose) {
  useEffect(() => {
    overlayStack.push(onClose);
    const onKey = (e) => {
      if (e.key === "Escape" && overlayStack[overlayStack.length - 1] === onClose) onClose?.();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      const i = overlayStack.lastIndexOf(onClose);
      if (i >= 0) overlayStack.splice(i, 1);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
}

/** Bottom sheet: handle + pinned head + ONE scrollable body + optional pinned footer. */
export function FdSheet({ title, onClose, children, footer, className = "" }) {
  useOverlayChrome(onClose);
  return (
    <FdPortal>
      <div className="fd-sheet-backdrop" onClick={onClose}>
        <div
          className={`fd-sheet ${className}`}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === "string" ? title : undefined}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="fd-sheet-grip" aria-hidden="true"><span className="fd-sheet-handle" /></div>
          {title != null && (
            <div className="fd-sheet-head">
              <b>{title}</b>
              <button className="fd-icon-btn" onClick={onClose} aria-label="Close">✕</button>
            </div>
          )}
          <div className="fd-sheet-body">{children}</div>
          {footer != null && <div className="fd-sheet-foot">{footer}</div>}
        </div>
      </div>
    </FdPortal>
  );
}

/** Full-screen layer (chat thread, group hub, live overlay).
    Header is pinned, body scrolls (or hosts a flex chat), footer pins an input bar. */
export function FdScreen({ title, meta, avatar, onBack, onBackLabel = "Back", actions, children, footer, className = "" }) {
  useOverlayChrome(onBack);
  return (
    <FdPortal>
      <div className={`fd-screen ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <div className="fd-screen-head">
          {onBack && (
            <button className="fd-backbtn" onClick={onBack} aria-label={onBackLabel}>←</button>
          )}
          {avatar}
          <div className="fd-screen-title-wrap">
            <div className="fd-screen-title">{title}</div>
            {meta != null && <div className="fd-screen-meta">{meta}</div>}
          </div>
          {actions}
        </div>
        <div className="fd-screen-body">{children}</div>
        {footer != null && <div className="fd-screen-foot">{footer}</div>}
      </div>
    </FdPortal>
  );
}


const AVATAR_COLORS = ["#3D5A80", "#5A3D80", "#3D8069", "#803D52", "#80693D", "#4A5568"];

function nameHash(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ user, uri, name, size = 38, live = false }) {
  const displayName = name || user?.name || user?.fullName || user?.username || "?";
  const src = uri || user?.avatar;
  const [failedSrc, setFailedSrc] = useState(null);
  const showImg = src && src !== failedSrc;
  const inner = (
    <div
      className="fd-avatar"
      style={live
        ? { fontSize: size * 0.36, background: AVATAR_COLORS[nameHash(displayName) % AVATAR_COLORS.length] }
        : { width: size, height: size, fontSize: size * 0.36, background: AVATAR_COLORS[nameHash(displayName) % AVATAR_COLORS.length] }}
    >
      {showImg ? <img src={src} alt="" onError={() => setFailedSrc(src)} /> : (displayName[0] || "?").toUpperCase()}
    </div>
  );
  if (!live) return inner;
  // Stories-style live presence ring (conic green→blue, slowly rotating)
  return <div className="fd-story-ring" style={{ width: size + 8, height: size + 8 }}>{inner}</div>;
}

export function SectionHeader({ title, hint, children }) {
  return (
    <div className="fd-section-head">
      <span className="fd-section-title">{title}</span>
      {children || (hint ? <span className="fd-section-hint">{hint}</span> : null)}
    </div>
  );
}

// Humanize raw filenames at render time: "Lipids_251020_194003.pdf" -> "Lipids"
export function displayTitle(title) {
  if (!title) return "";
  const clean = String(title)
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter((p) => !/^\d{5,}$/.test(p))
    .join(" ")
    .trim();
  return clean || title;
}

export function relTime(ts) {
  const d = new Date(ts);
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
