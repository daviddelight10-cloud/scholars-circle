// ── Appearance (light / dark / system) ─────────────────────────────────────────
// The stored preference is "system" (default) | "light" | "dark". The resolved
// theme lands on <html data-theme="light|dark">; CSS vars under
// `html[data-theme="light"]` (overriding the dark :root defaults) drive the app.
const APPEARANCE_KEY = "sc-appearance";
const MEDIA_LIGHT =
  typeof window !== "undefined"
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null;

export function getAppearancePref() {
  try {
    const v = localStorage.getItem(APPEARANCE_KEY);
    return v === "light" || v === "dark" || v === "system" ? v : "system";
  } catch {
    return "system";
  }
}

export function resolveAppearance(pref = getAppearancePref()) {
  if (pref === "system") return MEDIA_LIGHT?.matches ? "light" : "dark";
  return pref;
}

export function getResolvedTheme() {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyResolvedTheme(resolved) {
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "light" ? "#f5f2e9" : "#0a0a0a");
}

export function setAppearancePref(pref) {
  try { localStorage.setItem(APPEARANCE_KEY, pref); } catch {}
  const resolved = resolveAppearance(pref);
  applyResolvedTheme(resolved);
  window.dispatchEvent(new CustomEvent("sc:theme-change", { detail: { pref, resolved } }));
  return resolved;
}

// Apply the resolved theme now, keep it in sync with OS changes (system pref),
// and notify `onChange(resolved)` for any later switch (OS or user toggle).
export function initTheme(onChange) {
  applyResolvedTheme(resolveAppearance());
  const onMedia = () => {
    if (getAppearancePref() !== "system") return;
    const resolved = resolveAppearance();
    applyResolvedTheme(resolved);
    onChange?.(resolved);
  };
  const onCustom = (e) => onChange?.(e.detail.resolved);
  MEDIA_LIGHT?.addEventListener("change", onMedia);
  window.addEventListener("sc:theme-change", onCustom);
  return () => {
    MEDIA_LIGHT?.removeEventListener("change", onMedia);
    window.removeEventListener("sc:theme-change", onCustom);
  };
}
// ─────────────────────────────────────────────────────────────────────────────

export const T = {
  ink: "var(--app-bg)",
  inkSoft: "var(--app-surface)",
  inkCard: "var(--app-card)",
  inkCard2: "var(--app-card2)",
  line: "var(--app-line)",
  lineStrong: "var(--app-line-strong)",
  text: "var(--app-text)",
  textDim: "var(--app-dim)",
  textFaint: "var(--app-faint)",
  blue: "var(--app-accent)",
  blueDim: "rgba(79,142,247,0.14)",
  gold: "#F5A623",
  goldDim: "rgba(245,166,35,0.14)",
  coral: "var(--app-red)",
  coralDim: "rgba(255,84,112,0.14)",
  green: "var(--app-green)",
  greenDim: "rgba(61,214,140,0.14)",
};

export const FONTS = {
  display: "'Syne', sans-serif",
  body: "'Manrope', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const RADIUS = {
  lg: "18px",
  sm: "12px",
};

const SUBJECT_COLORS = ["#FFD700", "#F5A623", "#3DD68C", "#FF5470"];

export function subjectColor(subject) {
  if (!subject) return SUBJECT_COLORS[0];
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length];
}
