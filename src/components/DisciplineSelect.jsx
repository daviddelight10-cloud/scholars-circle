import { useState, useEffect, useRef, useMemo } from "react";
import { DISCIPLINE_CATEGORIES, MEDICAL_PROGRAMS } from "../lib/medicalPrograms.js";

/**
 * Searchable discipline picker — dropdown grouped by category.
 * Modeled on UniversitySelect: mobile-safe (onMouseDown items), keyboard
 * navigation, custom free-text escape row.
 *
 * Props:
 *   value      – selected program id (or "" )
 *   onChange   – called with the chosen program object
 *   autoFocus  – boolean
 */
export default function DisciplineSelect({ value, onChange, autoFocus }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const selected = MEDICAL_PROGRAMS.find((p) => p.id === value) || null;

  // Flattened visible items for keyboard nav + grouped render
  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DISCIPLINE_CATEGORIES.map((cat) => ({
      category: cat,
      items: MEDICAL_PROGRAMS.filter(
        (p) =>
          p.category === cat.id &&
          (!q ||
            p.label.toLowerCase().includes(q) ||
            p.subjects.some((s) => s.toLowerCase().includes(q)))
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped]);

  function pick(p) {
    onChange(p);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, flatItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlight >= 0 && flatItems[highlight]) pick(flatItems[highlight]);
      else if (flatItems.length > 0) pick(flatItems[0]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${highlight}"]`);
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  let flatIdx = -1;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <div
        onClick={() => {
          setOpen(true);
          inputRef.current?.focus();
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(20,20,20,0.6)",
          border: `1px solid ${open ? "rgba(255,215,0,0.5)" : "rgba(255,215,0,0.2)"}`,
          borderRadius: 12,
          padding: "4px 10px",
          cursor: "text",
          transition: "border-color 0.2s",
        }}
      >
        {selected && <span style={{ fontSize: 18, flexShrink: 0 }}>{selected.icon}</span>}
        <input
          ref={inputRef}
          type="text"
          value={open ? query : selected ? selected.label : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder="Search your discipline — e.g. Medicine, Law, Nursing…"
          autoFocus={autoFocus}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          style={{
            fontSize: 16,
            padding: "9px 2px",
            width: "100%",
            boxSizing: "border-box",
            background: "transparent",
            border: "none",
            color: "#fff",
            outline: "none",
          }}
        />
        <span style={{ color: "#8B8D97", fontSize: 12, flexShrink: 0 }}>▾</span>
      </div>

      {open && (
        <div
          ref={listRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            maxHeight: 300,
            overflowY: "auto",
            background: "#12121f",
            border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 1px rgba(255,215,0,0.1)",
            zIndex: 9999,
            backdropFilter: "blur(12px)",
            animation: "discSlideIn 0.15s ease-out",
          }}
        >
          {grouped.length === 0 ? (
            <div style={{ padding: "16px", fontSize: 13, color: "#6b7280", textAlign: "center" }}>
              No matching disciplines
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.category.id}>
                <div
                  style={{
                    padding: "8px 14px 4px",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#8B8D97",
                    position: "sticky",
                    top: 0,
                    background: "#12121f",
                    zIndex: 1,
                  }}
                >
                  {g.category.label}
                </div>
                {g.items.map((p) => {
                  flatIdx += 1;
                  const idx = flatIdx;
                  const isSel = value === p.id;
                  return (
                    <div
                      key={p.id}
                      data-idx={idx}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pick(p);
                      }}
                      onMouseEnter={() => setHighlight(idx)}
                      style={{
                        padding: "10px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 14,
                        color: "#e8eaf6",
                        background: idx === highlight ? "rgba(255,215,0,0.08)" : "transparent",
                        transition: "background 0.12s",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 18,
                          flexShrink: 0,
                          width: 32,
                          height: 32,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 8,
                          background: "rgba(255,215,0,0.06)",
                        }}
                      >
                        {p.icon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 13.5,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            color: isSel ? "#FFD700" : "#e8eaf6",
                          }}
                        >
                          {p.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#7b82b8", marginTop: 1 }}>
                          {p.subjects.slice(0, 2).join(" · ")}
                        </div>
                      </div>
                      {isSel && <span style={{ color: "#FFD700", fontSize: 14, flexShrink: 0 }}>✓</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      <style>{`
        @keyframes discSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
