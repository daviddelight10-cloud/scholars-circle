import { useState, useEffect, useRef, useMemo } from "react";

/**
 * Modern university/school autocomplete select.
 *
 * Props:
 *   value       – current text value (string)
 *   onChange     – called with { value, university } on every change;
 *                  university is the matched object or null
 *   universities – array of { id, name, type, city }
 *   placeholder  – input placeholder
 *   autoFocus    – boolean
 *
 * Mobile-safe: uses onMouseDown preventDefault on items so the input never
 * blurs before the click registers.  No document-level listeners needed.
 */
export default function UniversitySelect({
  value,
  onChange,
  universities,
  placeholder,
  autoFocus,
  style,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = useMemo(() => {
    if (!value) return universities.slice(0, 50);
    const q = value.toLowerCase();
    return universities
      .filter((u) => u.name && u.name.toLowerCase().includes(q))
      .slice(0, 50);
  }, [value, universities]);

  const exactMatch = useMemo(() => {
    if (!value) return true;
    return universities.some((u) => u.name && u.name.toLowerCase() === value.toLowerCase());
  }, [value, universities]);

  function handleInput(e) {
    onChange(e.target.value, null);
    setOpen(true);
    setHighlight(-1);
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleBlur() {
    // delay so item click fires before we close
    setTimeout(() => setOpen(false), 150);
  }

  function pick(u) {
    onChange(u.name, u);
    setOpen(false);
    inputRef.current?.blur();
  }

  function pickCustom() {
    onChange(value, { id: null, name: value, type: "university", city: null });
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e) {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlight >= 0) {
      e.preventDefault();
      pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  // scroll highlighted item into view
  useEffect(() => {
    if (highlight < 0 || !listRef.current) return;
    const el = listRef.current.children[highlight];
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [highlight]);

  const icon = (type) =>
    type === "school" ? "🏫" : type === "polytechnic" ? "🏛️" : "🎓";
  const label = (type) =>
    type === "school"
      ? "Secondary School"
      : type === "polytechnic"
      ? "Polytechnic"
      : "University";

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInput}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        style={{
          fontSize: 16,
          padding: "12px 14px",
          width: "100%",
          boxSizing: "border-box",
          background: "rgba(20,20,20,0.6)",
          border: "1px solid rgba(255,215,0,0.2)",
          borderRadius: 12,
          color: "#fff",
          outline: "none",
          transition: "border-color 0.2s",
          ...style,
        }}
        onFocusCapture={(e) => {
          e.target.style.borderColor = "rgba(255,215,0,0.5)";
        }}
        onBlurCapture={(e) => {
          e.target.style.borderColor = "rgba(255,215,0,0.2)";
        }}
      />

      {open && (
        <div
          ref={listRef}
          className="uni-select-dropdown"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: 6,
            maxHeight: 260,
            overflowY: "auto",
            background: "#12121f",
            border: "1px solid rgba(255,215,0,0.25)",
            borderRadius: 12,
            boxShadow: "0 12px 40px rgba(0,0,0,0.6), 0 0 1px rgba(255,215,0,0.1)",
            zIndex: 9999,
            backdropFilter: "blur(12px)",
            animation: "uniSlideIn 0.15s ease-out",
          }}
        >
          {filtered.length === 0 && !value ? (
            <div
              style={{
                padding: "16px 16px",
                fontSize: 13,
                color: "#6b7280",
                textAlign: "center",
              }}
            >
              {universities.length === 0 ? "Loading universities…" : "No results"}
            </div>
          ) : (
            <>
              {filtered.map((u, i) => (
                <div
                  key={u.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(u);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  style={{
                    padding: "11px 14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    color: "#e8eaf6",
                    background:
                      i === highlight
                        ? "rgba(255,215,0,0.08)"
                        : "transparent",
                    transition: "background 0.12s",
                    borderBottom:
                      i < filtered.length - 1 || (!exactMatch && value)
                        ? "1px solid rgba(255,255,255,0.04)"
                        : "none",
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
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
                    {icon(u.type)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 14,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {u.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#7b82b8", marginTop: 1 }}>
                      {label(u.type)}
                      {u.city ? " · " + u.city : ""}
                    </div>
                  </div>
                  {i === highlight && (
                    <span
                      style={{
                        fontSize: 16,
                        color: "#FFD700",
                        flexShrink: 0,
                      }}
                    >
                      ↵
                    </span>
                  )}
                </div>
              ))}
              {value && !exactMatch && (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickCustom();
                  }}
                  onMouseEnter={() => setHighlight(filtered.length)}
                  style={{
                    padding: "11px 14px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    color: "#FFD700",
                    background:
                      highlight === filtered.length
                        ? "rgba(255,215,0,0.08)"
                        : "transparent",
                    transition: "background 0.12s",
                  }}
                >
                  <span
                    style={{
                      fontSize: 20,
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: 8,
                      background: "rgba(255,215,0,0.1)",
                    }}
                  >
                    ✏️
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      Use "{value}"
                    </div>
                    <div style={{ fontSize: 11, color: "#7b82b8", marginTop: 1 }}>
                      Add as custom entry
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes uniSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
