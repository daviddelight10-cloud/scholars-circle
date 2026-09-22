import { useState } from "react";

/**
 * Bottom sheet (mobile) / centered dialog (desktop) picker with optional search.
 * items: [{ icon, label, sub, value }]
 */
export default function PickerSheet({ open, onClose, title, subtitle, items = [], selected, onPick, searchable = false }) {
  const [query, setQuery] = useState("");
  if (!open) return null;

  const q = (query || "").toLowerCase();
  const filtered = q
    ? items.filter(
        (it) =>
          String(it.label).toLowerCase().includes(q) ||
          (it.sub && String(it.sub).toLowerCase().includes(q))
      )
    : items;

  return (
    <div className="st-sheet" role="dialog" aria-label={title}>
      <div className="st-scrim" onClick={onClose} />
      <div className="st-shpanel">
        <div className="st-grab" />
        <div className="st-sh-head">
          <div>
            <b>{title}</b>
            {subtitle && <small>{subtitle}</small>}
          </div>
          <button className="st-sh-x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {searchable && (
          <div className="st-sh-search">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search…"
              autoFocus
            />
          </div>
        )}
        <div className="st-sh-list">
          {filtered.length === 0 && <div className="st-sh-empty">No match for "{query}"</div>}
          {filtered.map((it) => (
            <button
              key={it.value}
              className={`st-shopt${it.value === selected ? " st-sel" : ""}`}
              onClick={() => {
                onPick(it.value);
                onClose();
              }}
            >
              <span className="st-so-ic">{it.icon}</span>
              <span className="st-so-tx">
                <b>{it.label}</b>
                {it.sub && <small>{it.sub}</small>}
              </span>
              <span className="st-so-chk">✓</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
