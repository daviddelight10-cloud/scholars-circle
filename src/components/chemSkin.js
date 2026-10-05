import { useState } from "react";
import { MODES, isLightTheme } from "../lib/moleculeDraw.js";

const MODE_KEY = "sc_chem_mode";

const SKINS = {
  dark: { bg: "#0d0f14", border: "rgba(255,215,0,0.2)", text: "#C9CFDB", muted: "#9AA3B5", caption: "#E8D9A0", chip: "rgba(255,255,255,0.06)", chipOn: "rgba(255,215,0,0.18)", chipOnText: "#FFD700", plate: "#0d0f14" },
  light: { bg: "#FFFFFF", border: "rgba(0,0,0,0.12)", text: "#1F2430", muted: "#667085", caption: "#1F2430", chip: "rgba(0,0,0,0.05)", chipOn: "rgba(37,99,235,0.12)", chipOnText: "#1D4ED8", plate: "#FFFFFF" },
  sepia: { bg: "#F6EFE0", border: "rgba(120,90,40,0.25)", text: "#3B2F1E", muted: "#7A6A50", caption: "#3B2F1E", chip: "rgba(120,90,40,0.1)", chipOn: "rgba(150,100,20,0.18)", chipOnText: "#8A5A00", plate: "#F6EFE0" },
};
export const skinFor = (theme) => SKINS[theme] || (isLightTheme(theme) ? SKINS.light : SKINS.dark);

// Remembers the student's preferred drawing style across all structures.
export function useChemMode() {
  const [pref, setPref] = useState(() => {
    try { const v = localStorage.getItem(MODE_KEY); return MODES.includes(v) ? v : null; } catch { return null; }
  });
  const choose = (m) => {
    setPref(m);
    try { localStorage.setItem(MODE_KEY, m); } catch { /* storage blocked — preference just won't persist */ }
  };
  return [pref, choose];
}
