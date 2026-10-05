import { useEffect, useRef, useState } from "react";
import { loadSmilesDrawer, parseSpecies, drawTreeToSvg } from "../lib/moleculeDraw.js";

// Renders a ```smiles block as a 2D skeletal structure. smiles-drawer is
// lazy-loaded so it only ships when a molecule actually appears. The SMILES
// line is auto-detected (models sometimes put the name first, or write a
// formula instead — KNOWN_SMILES rescues common molecules); if nothing
// resolves, the raw text is shown instead of breaking the section.
export default function MoleculeView({ body }) {
  const hostRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [info, setInfo] = useState({ smiles: "", label: "" });

  useEffect(() => {
    const lines = String(body || "").split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) { setStatus("fail"); return; }
    let cancelled = false;
    loadSmilesDrawer().then((S) => {
      if (cancelled) return;

      // Use whichever line actually parses as SMILES; the rest becomes the caption.
      let hit = null, smiIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        hit = parseSpecies(S, lines[i]);
        if (hit) { smiIdx = i; break; }
      }
      if (!hit) {
        console.warn("[MoleculeView] no usable SMILES in block:", body);
        if (!cancelled) { setInfo({ smiles: lines[0], label: lines.slice(1).join(" ") }); setStatus("fail"); }
        return;
      }
      if (!cancelled) setInfo({ smiles: lines[smiIdx], label: lines.filter((_, i) => i !== smiIdx).join(" ") });
      try {
        const host = hostRef.current;
        if (!host) return;
        const svg = drawTreeToSvg(S, hit.tree, 340, 220);
        host.innerHTML = "";
        host.appendChild(svg);
        if (!cancelled) setStatus("ok");
      } catch (e) {
        console.warn("[MoleculeView] draw failed:", e);
        if (!cancelled) setStatus("fail");
      }
    }).catch((e) => {
      console.warn("[MoleculeView] smiles-drawer load failed:", e);
      if (!cancelled) setStatus("fail");
    });
    return () => { cancelled = true; };
  }, [body]);

  return (
    <div style={{
      margin: "10px 0", padding: "12px 14px", borderRadius: 12,
      background: "#0d0f14", border: "0.5px solid rgba(255,215,0,0.2)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    }}>
      <div ref={hostRef} style={{ display: status === "ok" ? "block" : "none", maxWidth: "100%" }} />
      {status === "loading" && (
        <div style={{ fontSize: 11, color: "#9AA3B5", fontFamily: "Manrope,sans-serif", padding: "12px 0" }}>
          Drawing structure…
        </div>
      )}
      {status === "fail" && (
        <div style={{
          fontSize: 12, color: "#C9CFDB", fontFamily: "monospace",
          background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "6px 12px",
        }}>
          {info.smiles || body}
        </div>
      )}
      {info.label && (
        <div style={{ fontSize: 11, color: "#E8D9A0", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>
          {info.label}
        </div>
      )}
    </div>
  );
}
