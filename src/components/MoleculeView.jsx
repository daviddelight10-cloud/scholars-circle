import { useEffect, useState } from "react";

let uid = 0;

// Renders a SMILES string as a 2D skeletal structure. smiles-drawer is
// lazy-loaded so it only hits the bundle when a molecule actually appears.
// Invalid SMILES (models hallucinate them sometimes) falls back to text.
export default function MoleculeView({ smiles, label }) {
  const [canvasId] = useState(() => `mol-${++uid}`);
  const [status, setStatus] = useState(smiles?.trim() ? "loading" : "fail");

  useEffect(() => {
    if (!smiles?.trim()) return;
    let cancelled = false;
    import("smiles-drawer").then((mod) => {
      const SmilesDrawer = mod.default || mod;
      if (cancelled || !SmilesDrawer?.Drawer) { setStatus("fail"); return; }
      try {
        const drawer = new SmilesDrawer.Drawer({ width: 340, height: 220, bondThickness: 1.2 });
        SmilesDrawer.parse(
          smiles.trim(),
          (tree) => {
            if (cancelled) return;
            try { drawer.draw(tree, canvasId, "dark", false); setStatus("ok"); }
            catch { setStatus("fail"); }
          },
          () => { if (!cancelled) setStatus("fail"); }
        );
      } catch { if (!cancelled) setStatus("fail"); }
    }).catch(() => { if (!cancelled) setStatus("fail"); });
    return () => { cancelled = true; };
  }, [smiles, canvasId]);

  return (
    <div style={{
      margin: "10px 0", padding: "12px 14px", borderRadius: 12,
      background: "#0d0f14", border: "0.5px solid rgba(255,215,0,0.2)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    }}>
      <canvas
        id={canvasId}
        style={{ maxWidth: "100%", display: status === "ok" ? "block" : "none" }}
      />
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
          {smiles}
        </div>
      )}
      {label && (
        <div style={{ fontSize: 11, color: "#E8D9A0", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>
          {label}
        </div>
      )}
    </div>
  );
}
