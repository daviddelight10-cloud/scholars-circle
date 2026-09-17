import { useEffect } from "react";
import McIcon from "./McIcon.jsx";

/**
 * Reusable bottom sheet (mobile) that becomes a centered modal on desktop (≥1024px).
 * Usage:
 *   <CircleSheet open={bool} onClose={fn} title="..." kind="Folder">
 *     ...body...
 *   </CircleSheet>
 */
export default function CircleSheet({ open, onClose, title, kind, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div className={`mc-backdrop${open ? " show" : ""}`} onClick={onClose} />
      <div className={`mc-sheet${open ? " open" : ""}`} role="dialog" aria-modal={open || undefined}>
        <div className="mc-sheet-grab" />
        <button className="mc-sheet-x" onClick={onClose} aria-label="Close">
          <McIcon name="x" />
        </button>
        <div className="mc-sheet-scroll" style={{ paddingTop: 12 }}>
          {(title || kind) && (
            <div className="mc-sheet-title-row">
              {title && <h2 className="mc-sheet-title">{title}</h2>}
              {kind && <span className="mc-sheet-kind">{kind}</span>}
            </div>
          )}
          {children}
        </div>
      </div>
    </>
  );
}
