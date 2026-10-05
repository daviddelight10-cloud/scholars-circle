import { useEffect, useRef, useState } from "react";
import { loadSmilesDrawer, parseSpecies, drawTreeToSvg } from "../lib/moleculeDraw.js";

// Renders a ```reaction block as a chemical equation: each species drawn with
// smiles-drawer, "+" between them, "→" with agents labeled underneath.
// Accepts reaction SMILES (reactants>agents>products) or "A + B → C + D"
// notation. If nothing parses, the raw text is shown instead of breaking.
export default function ReactionView({ body }) {
  const hostRef = useRef(null);
  const [status, setStatus] = useState("loading");
  const [caption, setCaption] = useState("");
  const [raw, setRaw] = useState("");

  useEffect(() => {
    const lines = String(body || "").split("\n").map(l => l.trim()).filter(Boolean);
    if (!lines.length) { setStatus("fail"); setRaw(body || ""); return; }
    let cancelled = false;

    loadSmilesDrawer().then((S) => {
      if (cancelled) return;
      const host = hostRef.current;
      if (!host) return;

      // Locate the reaction line — a >-notation reaction SMILES or an arrow.
      let rxnIdx = lines.findIndex(l => l.includes(">"));
      if (rxnIdx === -1) rxnIdx = lines.findIndex(l => /→|->/.test(l));
      if (rxnIdx === -1) {
        if (!cancelled) { setStatus("fail"); setRaw(lines.join(" ")); }
        return;
      }
      const rxn = lines[rxnIdx];
      const rest = lines.filter((_, i) => i !== rxnIdx).join(" ");

      let lhs, agents = "", rhs;
      if (rxn.includes(">")) {
        // Reaction SMILES: reactants>agents>products (agents may be empty).
        const parts = rxn.split(">");
        lhs = parts[0] || "";
        rhs = parts.length >= 3 ? parts[2] : (parts[1] || "");
        agents = parts.length >= 3 ? parts[1] : "";
      } else {
        const sides = rxn.split(/→|->/);
        lhs = sides[0] || "";
        rhs = sides[1] || "";
      }

      // "." separates species in SMILES; "+" in plain notation. Both safe to
      // split on — neither is a valid atom/bond token.
      const reactants = lhs.split(/[.+]/).map(s => s.trim()).filter(Boolean).slice(0, 6);
      const products  = rhs.split(/[.+]/).map(s => s.trim()).filter(Boolean).slice(0, 6);
      const agentList = agents.split(/[.+]/).map(s => s.trim()).filter(Boolean).slice(0, 4);
      if (!reactants.length || !products.length) {
        if (!cancelled) { setStatus("fail"); setRaw(rxn); }
        return;
      }

      try {
        host.innerHTML = "";
        const row = document.createElement("div");
        row.style.cssText =
          "display:flex;align-items:center;justify-content:center;gap:6px;flex-wrap:wrap";

        const plus = () => {
          const el = document.createElement("span");
          el.textContent = "+";
          el.style.cssText = "color:#9AA3B5;font-size:18px;font-weight:600;font-family:Manrope,sans-serif";
          return el;
        };

        const drawSpecies = (species) => {
          const hit = parseSpecies(S, species);
          if (!hit) return null;
          return drawTreeToSvg(S, hit.tree, 150, 110);
        };

        reactants.forEach((sp, i) => {
          if (i > 0) row.appendChild(plus());
          const svg = drawSpecies(sp);
          if (!svg) throw new Error(`unparseable reactant: ${sp}`);
          row.appendChild(svg);
        });

        const arrow = document.createElement("div");
        arrow.style.cssText =
          "display:flex;flex-direction:column;align-items:center;gap:2px;flex-shrink:0;margin:0 4px";
        const arrowTxt = document.createElement("span");
        arrowTxt.textContent = "→";
        arrowTxt.style.cssText = "color:#FFD700;font-size:22px;line-height:1";
        arrow.appendChild(arrowTxt);
        if (agentList.length) {
          const ag = document.createElement("span");
          ag.textContent = agentList.join(" · ");
          ag.style.cssText =
            "color:#9AA3B5;font-size:10px;font-family:Manrope,sans-serif;max-width:120px;text-align:center";
          arrow.appendChild(ag);
        }
        row.appendChild(arrow);

        products.forEach((sp, i) => {
          if (i > 0) row.appendChild(plus());
          const svg = drawSpecies(sp);
          if (!svg) throw new Error(`unparseable product: ${sp}`);
          row.appendChild(svg);
        });

        host.appendChild(row);
        if (!cancelled) { setCaption(rest); setStatus("ok"); }
      } catch (e) {
        console.warn("[ReactionView] draw failed:", e);
        if (!cancelled) { setStatus("fail"); setRaw(rxn); }
      }
    }).catch((e) => {
      console.warn("[ReactionView] smiles-drawer load failed:", e);
      if (!cancelled) { setStatus("fail"); setRaw(lines.join(" ")); }
    });

    return () => { cancelled = true; };
  }, [body]);

  return (
    <div style={{
      margin: "10px 0", padding: "12px 14px", borderRadius: 12,
      background: "#0d0f14", border: "0.5px solid rgba(255,215,0,0.2)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
    }}>
      <div ref={hostRef} style={{ display: status === "ok" ? "block" : "none", maxWidth: "100%", overflowX: "auto" }} />
      {status === "loading" && (
        <div style={{ fontSize: 11, color: "#9AA3B5", fontFamily: "Manrope,sans-serif", padding: "12px 0" }}>
          Drawing reaction…
        </div>
      )}
      {status === "fail" && (
        <div style={{
          fontSize: 12, color: "#C9CFDB", fontFamily: "monospace",
          background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: "6px 12px",
        }}>
          {raw || body}
        </div>
      )}
      {caption && (
        <div style={{ fontSize: 11, color: "#E8D9A0", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>
          {caption}
        </div>
      )}
    </div>
  );
}
