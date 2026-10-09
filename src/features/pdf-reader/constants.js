// ── Theme palettes ────────────────────────────────────────────────────────────
export const THEMES = {
  light: {
    bg: "#EFEEE8", toolbar: "#fff", border: "#C9C5B8", text: "#2D2823",
    muted: "#6B665C", accent: "#C23B3B", hover: "rgba(194,59,59,0.10)",
    inputBg: "#F2F0EA", chatBot: "#EEEAE2", thumbBg: "#FBFAF6",
    shadow: "rgba(0,0,0,0.14)", chipBg: "#E8E5DD",
  },
  dark: {
    bg: "#1a1a2e", toolbar: "#16213e", border: "#0f3460", text: "#e0e0e0",
    muted: "#8892b0", accent: "#e94560", hover: "rgba(233,69,96,0.15)",
    inputBg: "#0f1626", chatBot: "#16213e", thumbBg: "#16213e",
    shadow: "rgba(0,0,0,0.40)", chipBg: "#1a1a2e",
  },
  // "dim" — image-safe night reading: the page is dimmed, not inverted, so
  // diagrams, photos and scans keep their true colors.
  dim: {
    bg: "#101014", toolbar: "#17171c", border: "#2a2a33", text: "#d8d8dc",
    muted: "#8f8f9a", accent: "#f0a500", hover: "rgba(240,165,0,0.14)",
    inputBg: "#1d1d24", chatBot: "#1d1d24", thumbBg: "#17171c",
    shadow: "rgba(0,0,0,0.45)", chipBg: "#1d1d24",
  },
  sepia: {
    bg: "#F5EFDD", toolbar: "#EFE8D3", border: "#DED2B0", text: "#3A3A3A",
    muted: "#6E6656", accent: "#8B5E34", hover: "rgba(139,94,52,0.10)",
    inputBg: "#EFE7CE", chatBot: "#EFE8D3", thumbBg: "#F8F2E1",
    shadow: "rgba(58,58,58,0.10)", chipBg: "#E9E0C4",
  },
};

// ── Highlighter pen colors ────────────────────────────────────────────────────
export const PEN_COLORS = [
  { name: "yellow", value: "rgba(255,235,59,0.35)" },
  { name: "green",  value: "rgba(76,175,80,0.35)" },
  { name: "pink",   value: "rgba(233,30,99,0.35)" },
  { name: "blue",   value: "rgba(33,150,243,0.35)" },
  { name: "orange", value: "rgba(255,152,0,0.35)" },
];

// ── Chrome palette (dark-glass UI from HTML prototype) ───────────────────────
export const CHROME = {
  ink:    "#0a0a0a",
  ink2:   "#141414",
  ink3:   "#1B212D",
  blue:   "#4F8EF7",
  gold:   "#F5A623",
  coral:  "#FF5470",
  green:  "#3DD68C",
  textDim:   "rgba(255,255,255,0.45)",
  textMid:   "rgba(255,255,255,0.65)",
  hair:      "rgba(255,255,255,0.08)",
};

// ── Annotate popover: pen ink colors ─────────────────────────────────────────
export const INK_COLORS = [
  { name: "ink",    value: "#1B212D" },
  { name: "blue",   value: "#4F8EF7" },
  { name: "coral",  value: "#FF5470" },
  { name: "green",  value: "#3DD68C" },
];

// ── Annotate popover: highlighter colors ─────────────────────────────────────
export const HIGHLIGHT_COLORS = [
  { name: "yellow", value: "rgba(255,211,77,0.4)" },
  { name: "green",  value: "rgba(126,224,138,0.4)" },
  { name: "pink",   value: "rgba(255,136,172,0.4)" },
  { name: "blue",   value: "rgba(123,176,255,0.4)" },
];

export const PEN_WIDTHS = [1.5, 2.5, 4];
export const HIGHLIGHT_WIDTHS = [10, 16, 24];
