import { useEffect, useMemo, useState } from "react";
import ChemCard from "./ChemCard.jsx";
import { skinFor, useChemMode } from "./chemSkin.js";
import { parseReactionBlock, prettyAgent } from "../lib/chemistry.js";
import { MODES, agentText, autoMode, isLightTheme, loadSmilesDrawer, renderReaction, resolveSpecies } from "../lib/moleculeDraw.js";

const MAX_AUTO_WIDTH = 720;

// Renders a ```reaction block: reactants + … → products with agents above the
// arrow and conditions below. Every species is validated/repaired like a
// ```smiles block; a species that cannot be drawn is written as text so the
// equation stays complete. Multi-step blocks draw one equation per step.
export default function ReactionView({ body, theme = "dark" }) {
  const light = isLightTheme(theme);
  const parsed = useMemo(() => parseReactionBlock(body), [body]);
  const [done, setDone] = useState({ body: null, S: null, steps: [] });
  const [pref, setPref] = useChemMode();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const S = await loadSmilesDrawer();
        const species = async (t) => {
          const r = await resolveSpecies(S, t);
          return r ? { smiles: r.smiles, suspect: r.suspect } : { text: prettyAgent(t) };
        };
        const steps = [];
        for (const st of parsed.steps) {
          const reactants = [], products = [];
          for (const t of st.reactants) reactants.push(await species(t));
          for (const t of st.products) products.push(await species(t));
          steps.push({ reactants, products, agents: st.agents.map(agentText), conditions: prettyAgent(st.conditions) });
        }
        if (!cancelled) setDone({ body, S, steps });
      } catch (err) {
        console.warn("[ReactionView] failed:", err);
        if (!cancelled) setDone({ body, S: null, steps: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [body, parsed]);

  const skin = skinFor(theme);
  const ready = done.body === body;
  const { S, steps } = done;
  const drawable = ready && S && steps.length && steps.every((st) => [...st.reactants, ...st.products].some((x) => x.smiles));

  let mode = pref;
  let rendered = [];
  if (drawable) {
    const smilesList = steps.flatMap((st) => [...st.reactants, ...st.products]).filter((x) => x.smiles).map((x) => x.smiles);
    const auto = smilesList.every((s) => autoMode(s) === "expanded") ? "expanded" : smilesList.some((s) => autoMode(s) === "skeletal") ? "skeletal" : "condensed";
    mode = pref || auto;
    rendered = steps.map((st) => renderReaction(S, st, { mode, light }));
    if (!pref && mode === "expanded" && rendered.some((r) => r.width > MAX_AUTO_WIDTH)) {
      mode = "condensed";
      rendered = steps.map((st) => renderReaction(S, st, { mode, light }));
    }
  }
  const copyText = ready ? parsed.steps.map((st) => `${st.reactants.join(".")}>${st.agents.join(".")}>${st.products.join(".")}`).join("\n") : "";

  return (
    <ChemCard
      theme={theme} modes={drawable ? MODES : []} mode={mode || "skeletal"} onMode={setPref}
      copyText={copyText} downloadMarkup={rendered.length === 1 ? rendered[0].markup : ""}
    >
      {({ zoom }) => (
        <>
          {!ready && <div style={{ fontSize: 11, color: skin.muted, fontFamily: "Manrope,sans-serif", padding: "12px 0" }}>Drawing reaction…</div>}
          {ready && !drawable && (
            <div style={{ fontSize: 12, color: skin.text, fontFamily: "monospace", background: "rgba(128,128,128,0.12)", borderRadius: 8, padding: "6px 12px", whiteSpace: "pre-wrap" }}>
              {parsed.raw}
            </div>
          )}
          {drawable && rendered.map((r, i) => (
            <div
              key={i} onClick={() => zoom(r.markup)} role="img" aria-label="Chemical reaction" title="Tap to enlarge"
              style={{ cursor: "zoom-in", maxWidth: "100%", overflowX: "auto" }}
              dangerouslySetInnerHTML={{ __html: r.markup }}
            />
          ))}
          {ready && parsed.caption && <div style={{ fontSize: 11, color: skin.caption, fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>{parsed.caption}</div>}
        </>
      )}
    </ChemCard>
  );
}
