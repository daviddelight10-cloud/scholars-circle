import { useEffect, useRef, useState } from "react";

// Canonical SMILES for common molecules — used when the model writes a name
// or molecular formula (C6H12O6) instead of a parseable SMILES string.
const KNOWN_SMILES = {
  // sugars
  glucose: "OCC1OC(O)C(O)C(O)C1O",
  fructose: "OCC1OC(O)(CO)C(O)C1O",
  galactose: "OCC1OC(O)C(O)C(O)C1O",
  mannose: "OCC1OC(O)C(O)C(O)C1O",
  ribose: "OCC1OC(O)C(O)C1O",
  deoxyribose: "OCC1OC(O)CC1O",
  sucrose: "OCC1OC(OC2(CO)OC(CO)C(O)C2O)C(O)C(O)C1O",
  lactose: "OCC1OC(OC2C(CO)OC(O)C(O)C2O)C(O)C(O)C1O",
  maltose: "OCC1OC(OC2C(CO)OC(O)C(O)C2O)C(O)C(O)C1O",
  glucose6phosphate: "O=P(O)(O)OCC1OC(O)C(O)C(O)C1O",
  // nucleobases + nucleosides
  adenine: "Nc1ncnc2c1nc[nH]2",
  guanine: "Nc1nc2c(nc[nH]2)c(=O)[nH]1",
  cytosine: "Nc1cc[nH]c(=O)n1",
  uracil: "O=c1[nH]cc[nH]c1=O",
  thymine: "Cc1c[nH]c(=O)[nH]c1=O",
  adenosine: "Nc1ncnc2c1ncn2C1OC(CO)C(O)C1O",
  atp: "Nc1ncnc2c1ncn2C1OC(COP(=O)(O)OP(=O)(O)OP(=O)(O)O)C(O)C1O",
  // neurotransmitters
  dopamine: "NCCc1cc(O)c(O)cc1",
  serotonin: "NCCc1c[nH]c2ccc(O)cc12",
  adrenaline: "CNCC(O)c1cc(O)c(O)cc1",
  epinephrine: "CNCC(O)c1cc(O)c(O)cc1",
  noradrenaline: "NCC(O)c1cc(O)c(O)cc1",
  norepinephrine: "NCC(O)c1cc(O)c(O)cc1",
  acetylcholine: "CC(=O)OCC[N+](C)(C)C",
  histamine: "NCCc1c[nH]cn1",
  gaba: "NCCCC(=O)O",
  glutamate: "NC(CCC(=O)O)C(=O)O",
  melatonin: "CC(=O)NCCc1c[nH]c2ccc(OC)cc12",
  // amino acids
  glycine: "NCC(=O)O",
  alanine: "CC(N)C(=O)O",
  valine: "CC(C)C(N)C(=O)O",
  leucine: "CC(C)CC(N)C(=O)O",
  isoleucine: "CCC(C)C(N)C(=O)O",
  serine: "NC(CO)C(=O)O",
  threonine: "CC(O)C(N)C(=O)O",
  cysteine: "NC(CS)C(=O)O",
  methionine: "CSCCC(N)C(=O)O",
  proline: "OC(=O)C1CCCN1",
  phenylalanine: "NC(Cc1ccccc1)C(=O)O",
  tyrosine: "NC(Cc1ccc(O)cc1)C(=O)O",
  tryptophan: "NC(Cc1c[nH]c2ccccc12)C(=O)O",
  aspartate: "NC(CC(=O)O)C(=O)O",
  asparagine: "NC(=O)CC(N)C(=O)O",
  lysine: "NCCCCC(N)C(=O)O",
  arginine: "NC(N)=NCCCC(N)C(=O)O",
  histidine: "NC(Cc1c[nH]cn1)C(=O)O",
  glutamine: "NC(=O)CCC(N)C(=O)O",
  // metabolites
  urea: "NC(=O)N",
  lactate: "CC(O)C(=O)O",
  lacticacid: "CC(O)C(=O)O",
  pyruvate: "CC(=O)C(=O)O",
  pyruvicacid: "CC(=O)C(=O)O",
  citrate: "OC(=O)CC(O)(CC(=O)O)C(=O)O",
  citricacid: "OC(=O)CC(O)(CC(=O)O)C(=O)O",
  aceticacid: "CC(=O)O",
  ethanol: "CCO",
  glycerol: "OCC(O)CO",
  palmiticacid: "CCCCCCCCCCCCCCCC(=O)O",
  oleicacid: "CCCCCCCCC=CCCCCCCCC(=O)O",
  betahydroxybutyrate: "CC(O)CC(=O)O",
  acetoacetate: "CC(=O)CC(=O)O",
  creatine: "CN(CC(=O)O)C(=N)N",
  ascorbicacid: "OCC(O)C1OC(=O)C(O)=C1O",
  vitaminc: "OCC(O)C1OC(=O)C(O)=C1O",
  // drugs
  aspirin: "CC(=O)Oc1ccccc1C(=O)O",
  paracetamol: "CC(=O)Nc1ccc(O)cc1",
  acetaminophen: "CC(=O)Nc1ccc(O)cc1",
  ibuprofen: "CC(C)Cc1ccc(C(C)C(=O)O)cc1",
  caffeine: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
  morphine: "CN1CCC23c4c5ccc(O)c4OC2C(O)C=CC3C1C5",
  metformin: "CN(C)C(=N)NC(=N)N",
  warfarin: "CC(=O)CC(C1=CC=CC=C1)C1=C(O)C2=CC=CC=C2OC1=O",
  cholesterol: "CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C",
  // small molecules
  benzene: "c1ccccc1",
  phenol: "Oc1ccccc1",
  aniline: "Nc1ccccc1",
  toluene: "Cc1ccccc1",
  water: "O",
  carbondioxide: "O=C=O",
  ammonia: "N",
  methane: "C",
};

const normKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Exact match, or name with a prefix like "d-glucose" / "α-d-glucose".
// (endsWith keeps "glucose-6-phosphate" from wrongly matching "glucose".)
function lookupSmiles(line) {
  const n = normKey(line);
  if (!n) return null;
  if (KNOWN_SMILES[n]) return KNOWN_SMILES[n];
  if (n.length > 5) {
    for (const [k, v] of Object.entries(KNOWN_SMILES)) {
      if (k.length >= 5 && n.endsWith(k)) return v;
    }
  }
  return null;
}

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
    import("smiles-drawer").then((mod) => {
      const S = mod.default || mod;
      if (cancelled || !S?.Parser || !S?.SvgDrawer) { setStatus("fail"); return; }

      // Use whichever line actually parses as SMILES; the rest becomes the caption.
      let tree = null, smiIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        try { const t = S.Parser.parse(lines[i]); if (t) { tree = t; smiIdx = i; break; } } catch {}
      }
      // Fallback: match a name/formula line against the known-SMILES table.
      if (!tree) {
        for (let i = 0; i < lines.length; i++) {
          const smi = lookupSmiles(lines[i]);
          if (smi) { try { tree = S.Parser.parse(smi); } catch {} if (tree) { smiIdx = i; break; } }
        }
      }
      if (!tree) {
        console.warn("[MoleculeView] no usable SMILES in block:", body);
        if (!cancelled) { setInfo({ smiles: lines[0], label: lines.slice(1).join(" ") }); setStatus("fail"); }
        return;
      }
      if (!cancelled) setInfo({ smiles: lines[smiIdx], label: lines.filter((_, i) => i !== smiIdx).join(" ") });
      try {
        const host = hostRef.current;
        if (!host) return;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 340 220");
        svg.setAttribute("width", "340");
        svg.setAttribute("height", "220");
        svg.style.maxWidth = "100%";
        svg.style.height = "auto";
        // Draw straight into the SVG element — synchronous, no canvas rasterize step.
        new S.SvgDrawer({ width: 340, height: 220, bondThickness: 1.2 }).draw(tree, svg, "dark", null, false);
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
