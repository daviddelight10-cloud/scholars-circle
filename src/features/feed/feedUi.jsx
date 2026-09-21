import { useState } from "react";

const AVATAR_COLORS = ["#3D5A80", "#5A3D80", "#3D8069", "#803D52", "#80693D", "#4A5568"];

function nameHash(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ user, uri, name, size = 38 }) {
  const displayName = name || user?.name || user?.fullName || user?.username || "?";
  const src = uri || user?.avatar;
  const [failedSrc, setFailedSrc] = useState(null);
  const showImg = src && src !== failedSrc;
  return (
    <div
      className="fd-avatar"
      style={{ width: size, height: size, fontSize: size * 0.36, background: AVATAR_COLORS[nameHash(displayName) % AVATAR_COLORS.length] }}
    >
      {showImg ? <img src={src} alt="" onError={() => setFailedSrc(src)} /> : (displayName[0] || "?").toUpperCase()}
    </div>
  );
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
