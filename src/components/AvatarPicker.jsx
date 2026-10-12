import { AVATARS } from "../lib/avatars.js";
import AvatarMark from "./AvatarMark.jsx";

// Character grid — tap to pick. `value` is "char:<id>"; onPick gets the same.
export default function AvatarPicker({ value, onPick, size = 56, cols = 4, style = {} }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols},1fr)`, gap: 10, ...style }} role="radiogroup" aria-label="Choose an avatar">
      {AVATARS.map((a) => {
        const key = `char:${a.id}`;
        const sel = value === key;
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={sel}
            aria-label={a.label}
            title={a.label}
            onClick={() => onPick(key)}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              borderRadius: "50%", position: "relative",
              outline: sel ? "2.5px solid #FFD700" : "2.5px solid transparent",
              outlineOffset: 3, transition: "transform .15s ease, outline-color .15s ease",
              transform: sel ? "scale(1.08)" : "scale(1)",
            }}
          >
            <AvatarMark avatar={key} name={a.label} size={size} />
            {sel && (
              <span style={{
                position: "absolute", bottom: -2, right: -2, width: 18, height: 18,
                borderRadius: "50%", background: "#FFD700", color: "#1A1300",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800, border: "2px solid #0B0B0D",
              }}>✓</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
