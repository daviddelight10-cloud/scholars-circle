import { useEffect, useMemo, useState } from "react";
import ChemCard from "./ChemCard.jsx";
import { skinFor, useChemMode } from "./chemSkin.js";
import { analyzeSmiles, condensedFormula, parseMoleculeBlock, subscript } from "../lib/chemistry.js";
import { MODES, autoMode, canExpand, isLightTheme, loadSmilesDrawer, renderMolecule, resolveSpecies } from "../lib/moleculeDraw.js";

const infoLine = (smiles) => {
  const info = analyzeSmiles(smiles);
  if (!info) return "";
  const parts = [];
  const cf = condensedFormula(info.graph);
  if (cf) parts.push(cf);
  parts.push(subscript(info.formula));
  if (info.mass) parts.push(`${info.mass.toFixed(2)} g/mol`);
  return parts.join("  ·  ");
};

// Renders a ```smiles block. Each line is checked (valid SMILES? matches the
// stated formula?) and repaired from the built-in library / PubChem when the
// model got it wrong. Simple chains default to textbook expanded formulas,
// rings to skeletal. Anything unresolvable stays visible as raw text.
export default function MoleculeView({ body, theme = "dark" }) {
  const light = isLightTheme(theme);
  const { entries, caption } = useMemo(() => parseMoleculeBlock(body), [body]);
  const [done, setDone] = useState({ body: null, S: null, items: [] });
  const [pref, setPref] = useChemMode();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const S = await loadSmilesDrawer();
        const items = [];
        for (const e of entries) items.push(await resolveSpecies(S, e.raw, e));
        if (!cancelled) setDone({ body, S, items });
      } catch (err) {
        console.warn("[MoleculeView] failed:", err);
        if (!cancelled) setDone({ body, S: null, items: entries.map(() => null) });
      }
    })();
    return () => { cancelled = true; };
  }, [body, entries]);

  const skin = skinFor(theme);
  const ready = done.body === body;
  const { S, items } = done;

  const drawn = ready ? items.map((it, i) => {
    if (!it || !S) return null;
    const mode = pref || autoMode(it.smiles);
    const r = renderMolecule(S, it.smiles, { mode, light });
    return r && { ...it, ...r, name: entries[i].name || it.label || "", info: infoLine(it.smiles) };
  }) : [];
  const activeMode = pref || drawn.find(Boolean)?.mode || "skeletal";
  const modes = !drawn.some(Boolean) ? [] : drawn.some((d) => d && canExpand(d.smiles, light)) ? MODES : MODES.filter((m) => m !== "expanded");
  const single = entries.length === 1;
  const only = single ? drawn[0] : null;

  return (
    <ChemCard
      theme={theme} modes={modes} mode={activeMode} onMode={setPref}
      copyText={ready ? drawn.map((d, i) => (d ? d.smiles : entries[i].raw)).join("\n") : ""}
      downloadMarkup={only?.markup || ""}
    >
      {({ zoom }) => (
        <>
          {!ready && <div style={{ fontSize: 11, color: skin.muted, fontFamily: "Manrope,sans-serif", padding: "12px 0" }}>Drawing structure…</div>}
          {ready && (
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 18, width: "100%" }}>
              {entries.map((e, i) => {
                const d = drawn[i];
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, maxWidth: "100%" }}>
                    {d ? (
                      <div
                        onClick={() => zoom(d.markup)} role="img" aria-label={`${e.name || "Chemical structure"} (${d.smiles})`}
                        title="Tap to enlarge" style={{ cursor: "zoom-in", maxWidth: "100%" }}
                        dangerouslySetInnerHTML={{ __html: d.markup }}
                      />
                    ) : (
                      <div style={{ fontSize: 12, color: skin.text, fontFamily: "monospace", background: "rgba(128,128,128,0.12)", borderRadius: 8, padding: "6px 12px" }}>
                        {e.raw || e.name}
                      </div>
                    )}
                    {(d?.name || e.name) && <div style={{ fontSize: 12, color: skin.caption, fontFamily: "Manrope,sans-serif", fontWeight: 700 }}>{d?.name || e.name}</div>}
                    {d?.info && <div style={{ fontSize: 10.5, color: skin.muted, fontFamily: "Manrope,sans-serif" }}>{d.info}</div>}
                    {d?.suspect && <div style={{ fontSize: 10.5, color: "#E0A100", fontFamily: "Manrope,sans-serif" }} title="The AI's structure did not match the stated formula and no reference was found.">Could not verify this structure</div>}
                  </div>
                );
              })}
            </div>
          )}
          {caption && <div style={{ fontSize: 11, color: skin.caption, fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>{caption}</div>}
        </>
      )}
    </ChemCard>
  );
}
