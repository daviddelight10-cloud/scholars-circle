import { findAvatar, avatarKeyOf } from "../lib/avatars.js";

// Shared avatar resolver. Renders, in order:
//   "char:<id>"        → inline SVG character (bundled, offline-safe)
//   http(s)/data/blob  → <img>
//   short emoji        → emoji text (legacy profiles)
//   null / other       → first initial on a colored disc (hashed by name)
const COLORS = ["#3D5A80", "#5A3D80", "#3D8069", "#803D52", "#80693D", "#4A5568"];

function nameHash(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const isImg = (s) => !!s && /^(https?:|data:|blob:)/.test(s);
const isEmoji = (s) => !!s && !isImg(s) && !s.includes(":") && [...s].length <= 4;

export default function AvatarMark({ avatar, name = "?", size = 38, color, className = "", style = {} }) {
  const char = avatarKeyOf(avatar);
  const def = char ? findAvatar(char) : null;
  const display = name || "?";
  const box = {
    width: size, height: size, borderRadius: "50%", overflow: "hidden",
    display: "flex", alignItems: "center", justifyContent: "center",
    background: def || isEmoji(avatar) ? "none" : color || COLORS[nameHash(display) % COLORS.length],
    color: "#fff", fontWeight: 700, fontSize: size * 0.36, flexShrink: 0,
    fontFamily: "inherit", lineHeight: 1, userSelect: "none",
    ...style,
  };
  return (
    <span className={`avm ${className}`} style={box} aria-hidden="true">
      {def ? (
        <svg width={size} height={size} viewBox="0 0 64 64" dangerouslySetInnerHTML={{ __html: def.svg }} />
      ) : isImg(avatar) ? (
        <img src={avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : isEmoji(avatar) ? (
        <span style={{ fontSize: size * 0.62, lineHeight: 1 }}>{avatar}</span>
      ) : (
        (display[0] || "?").toUpperCase()
      )}
    </span>
  );
}
