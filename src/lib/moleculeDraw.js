// Shared chemistry rendering — used by MoleculeView (```smiles blocks) and
// ReactionView (```reaction blocks).
//   • resolveSpecies: model text → a trustworthy SMILES (validate, then fall
//     back to the built-in library, then PubChem by name)
//   • renderMolecule: SMILES → SVG in one of three student-friendly modes
//     (expanded formula / condensed zig-zag / skeletal line-angle)
//   • renderReaction: one SVG per reaction step
// smiles-drawer is lazy-loaded so it only ships when chemistry appears.

import { analyzeSmiles, isValidSmiles, parseFormula, sameCounts, stripAtomMaps, agentLabel, prettyAgent } from "./chemistry.js";
import { renderExpandedSvg } from "./expandedFormula.js";

export const MODES = ["expanded", "condensed", "skeletal"];
export const MODE_LABELS = { expanded: "Expanded", condensed: "Condensed", skeletal: "Skeletal" };
export const isLightTheme = (theme) => theme === "light" || theme === "sepia";

let sdPromise = null;
export function loadSmilesDrawer() {
  sdPromise ||= import("smiles-drawer").then((mod) => {
    const S = mod.default || mod;
    if (!S?.Parser || !S?.SvgDrawer) throw new Error("smiles-drawer unavailable");
    return S;
  });
  sdPromise.catch(() => { sdPromise = null; });
  return sdPromise;
}

// ---- SMILES validation ------------------------------------------------------
export function canParse(S, smiles) {
  if (!smiles || !isValidSmiles(smiles)) return false;
  try { return !!S.Parser.parse(smiles); } catch { return false; }
}

// ---- built-in library + PubChem --------------------------------------------
const normKey = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const STEREO_PREFIXES = ["alphad", "betad", "alphal", "betal", "alpha", "beta", "trans", "cis", "dl", "d", "l", "rac", "s", "r"];

let knownPromise = null;
const loadKnown = () => (knownPromise ||= import("./knownMolecules.json").then((m) => m.default || m).catch(() => ({})));

export async function lookupKnown(text) {
  const known = await loadKnown();
  const n = normKey(text);
  if (!n) return null;
  let hit = known[n];
  for (const p of STEREO_PREFIXES) {
    if (hit) break;
    if (n.startsWith(p) && known[n.slice(p.length)]) hit = known[n.slice(p.length)];
  }
  return hit ? { smiles: hit[0], formula: hit[1], name: hit[2] } : null;
}

const PC_KEY = "sc_pubchem_v1";
const PC_HIT_TTL = 30 * 864e5, PC_MISS_TTL = 3 * 864e5, PC_MAX = 300;
const pcMem = new Map();
let pcStore = null, pcChain = Promise.resolve();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const readStore = () => {
  if (pcStore) return pcStore;
  try { pcStore = JSON.parse(localStorage.getItem(PC_KEY) || "{}"); } catch { pcStore = {}; }
  return pcStore;
};
const writeStore = (key, value) => {
  const store = readStore();
  store[key] = { ...value, t: Date.now() };
  const keys = Object.keys(store);
  if (keys.length > PC_MAX) keys.sort((a, b) => store[a].t - store[b].t).slice(0, keys.length - PC_MAX).forEach((k) => delete store[k]);
  try { localStorage.setItem(PC_KEY, JSON.stringify(store)); } catch { /* storage full or blocked — memory cache still works */ }
};

async function fetchPubchem(name, key) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/SMILES,MolecularFormula/JSON`;
    const r = await fetch(url, { signal: ctrl.signal });
    if (r.status === 404) { writeStore(key, { s: "" }); return null; }
    if (!r.ok) return null;
    const p = (await r.json()).PropertyTable?.Properties?.[0];
    const smiles = p?.SMILES || p?.IsomericSMILES;
    if (!smiles) { writeStore(key, { s: "" }); return null; }
    writeStore(key, { s: smiles, f: p.MolecularFormula });
    return { smiles, formula: p.MolecularFormula };
  } catch { return null; } finally { clearTimeout(timer); await sleep(220); }
}

// Name → { smiles, formula } via PubChem (free, CORS-enabled). Cached in
// memory + localStorage, and serialized to stay under PubChem's rate limit.
export function pubchemLookup(name) {
  const q = String(name || "").trim();
  if (q.length < 3 || q.length > 80 || (typeof navigator !== "undefined" && navigator.onLine === false)) return Promise.resolve(null);
  const key = q.toLowerCase();
  if (pcMem.has(key)) return pcMem.get(key);
  const c = readStore()[key];
  if (c && Date.now() - c.t < (c.s ? PC_HIT_TTL : PC_MISS_TTL)) {
    const v = c.s ? { smiles: c.s, formula: c.f } : null;
    pcMem.set(key, Promise.resolve(v));
    return pcMem.get(key);
  }
  const p = (pcChain = pcChain.then(() => fetchPubchem(q, key)));
  pcMem.set(key, p);
  p.then((v) => { if (!v) pcMem.delete(key); });
  return p;
}

// Turns whatever the model wrote for one species into a SMILES we trust.
// Returns { smiles, source: "model"|"library"|"pubchem", suspect? } or null.
export async function resolveSpecies(S, raw, { name = "", formula = "" } = {}) {
  const cand = stripAtomMaps(String(raw || "").trim());
  const ok = canParse(S, cand);
  const info = ok ? analyzeSmiles(cand) : null;
  let suspect = false;
  if (ok) {
    const want = formula ? parseFormula(formula) : null;
    if (info && want && !sameCounts(info.counts, want)) suspect = true;
    const lib = name ? await lookupKnown(name) : null;
    const libCounts = lib && parseFormula(lib.formula);
    if (info && libCounts && !sameCounts(info.counts, libCounts) && canParse(S, lib.smiles)) return { smiles: lib.smiles, source: "library", label: lib.name };
    if (!suspect) return { smiles: cand, source: "model" };
  }
  const queries = [name, ok ? "" : cand].filter(Boolean);
  for (const q of queries) {
    const lib = await lookupKnown(q);
    if (lib && canParse(S, lib.smiles)) return { smiles: lib.smiles, source: "library", label: lib.name };
  }
  for (const q of queries.filter((x) => /[A-Za-z]{3,}/.test(x))) {
    const pc = await pubchemLookup(q);
    if (pc && canParse(S, pc.smiles)) return { smiles: pc.smiles, source: "pubchem", label: q };
  }
  return ok ? { smiles: cand, source: "model", suspect: true } : null;
}

// ---- drawing ----------------------------------------------------------------
const svgCache = new Map();
const cached = (key, make) => {
  if (svgCache.has(key)) return svgCache.get(key);
  const v = make();
  if (v) { svgCache.set(key, v); if (svgCache.size > 300) svgCache.delete(svgCache.keys().next().value); }
  return v;
};

const drawerOpts = (mode, extra = {}) => ({
  bondLength: 26, bondSpacing: 0.17 * 26, scale: 1, fontSizeLarge: 10, fontSizeSmall: 6,
  padding: 10, bondThickness: 1.2, terminalCarbons: mode === "condensed", compactDrawing: false, ...extra,
});

function drawWithSmilesDrawer(S, smiles, mode, light) {
  const attempt = (extra) => {
    const svg = new S.SvgDrawer(drawerOpts(mode, extra)).draw(S.Parser.parse(smiles), null, light ? "light" : "dark");
    const width = parseFloat(svg.style.width) || 200, height = parseFloat(svg.style.height) || 150;
    svg.style.maxWidth = "100%";
    svg.style.height = "auto";
    return { markup: svg.outerHTML, width, height };
  };
  try { return attempt({}); } catch { return attempt({ experimentalSSSR: true }); }
}

// SMILES → { markup, mode, width, height }. `mode` is the mode actually used
// (expanded silently falls back to condensed for rings/large molecules).
export function renderMolecule(S, smiles, { mode = "skeletal", light = false } = {}) {
  return cached(`${mode}|${light ? 1 : 0}|${smiles}`, () => {
    try {
      if (mode === "expanded") {
        const r = renderExpandedSvg(smiles, { light });
        if (r) return { ...r, mode: "expanded" };
        const fallback = analyzeSmiles(smiles)?.hasRing ? "skeletal" : "condensed";
        return { ...drawWithSmilesDrawer(S, smiles, fallback, light), mode: fallback };
      }
      return { ...drawWithSmilesDrawer(S, smiles, mode, light), mode };
    } catch (e) {
      console.warn("[chem] draw failed:", smiles, e);
      return null;
    }
  });
}

export const canExpand = (smiles, light = false) => !!renderExpandedSvg(smiles, { light });

// The default mode for a molecule: simple chains as expanded formulas, other
// acyclic molecules condensed, everything with rings skeletal.
export function autoMode(smiles) {
  const info = analyzeSmiles(smiles);
  if (!info) return "skeletal";
  if (info.heavy <= 8 && canExpand(smiles)) return "expanded";
  return info.hasRing ? "skeletal" : "condensed";
}

// ---- reactions --------------------------------------------------------------
const NS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== undefined) el.textContent = text;
  return el;
};
const wrapText = (text, max = 22) => {
  const lines = [];
  let line = "";
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > max) { lines.push(line); line = word; } else line = line ? line + " " + word : word;
  }
  return line ? lines.concat(line) : lines;
};
const textWidth = (t, size) => t.length * size * 0.58;

// species: [{ smiles } | { text }]; agents/conditions: plain strings.
// Returns { markup, width, height, mode } — one SVG for a single step.
export function renderReaction(S, { reactants, agents = [], products, conditions = "" }, { mode = "skeletal", light = false } = {}) {
  const ink = light ? "#1F2430" : "#EDEFF5", muted = light ? "#667085" : "#9AA3B5", accent = light ? "#444B5A" : "#FFD700";
  const GAP = 12, SIZE = 12;
  const items = [];
  const usedModes = new Set();

  const speciesItem = (sp) => {
    if (sp.smiles) {
      const r = renderMolecule(S, sp.smiles, { mode, light });
      if (r) {
        usedModes.add(r.mode);
        const tpl = document.createElement("template");
        tpl.innerHTML = r.markup.trim();
        const node = tpl.content.firstElementChild;
        node.removeAttribute("style");
        return { node, w: r.width, h: r.height };
      }
    }
    const label = sp.text || sp.smiles || "?";
    const w = Math.max(24, textWidth(label, 14) + 12);
    const g = svgEl("svg", { viewBox: `0 0 ${w} 24` });
    g.appendChild(svgEl("text", { x: w / 2, y: 12, fill: ink, "font-size": 14, "text-anchor": "middle", "dominant-baseline": "central" }, label));
    return { node: g, w, h: 24 };
  };
  const plus = () => {
    const g = svgEl("svg", { viewBox: "0 0 14 24" });
    g.appendChild(svgEl("text", { x: 7, y: 12, fill: muted, "font-size": 18, "font-weight": 600, "text-anchor": "middle", "dominant-baseline": "central" }, "+"));
    return { node: g, w: 14, h: 24 };
  };
  const addSide = (list) => list.forEach((sp, i) => { if (i) items.push(plus()); items.push(speciesItem(sp)); });

  addSide(reactants);
  const above = wrapText(agents.join(", ")), below = wrapText(conditions);
  const textW = Math.max(0, ...[...above, ...below].map((l) => textWidth(l, SIZE)));
  const arrowW = Math.max(64, Math.min(220, textW + 24));
  items.push({ arrow: true, w: arrowW, h: 24 });
  addSide(products);

  const maxH = Math.max(40, ...items.map((it) => it.h)) + (above.length + below.length > 2 ? 16 : 0);
  const total = items.reduce((t, it) => t + it.w + GAP, -GAP);
  const root = svgEl("svg", { xmlns: NS, viewBox: `0 0 ${Math.round(total)} ${Math.round(maxH)}`, width: Math.round(total), height: Math.round(maxH), "font-family": "Arial, Helvetica, sans-serif" });
  let x = 0;
  const cy = maxH / 2;
  for (const it of items) {
    if (it.arrow) {
      root.appendChild(svgEl("line", { x1: x, y1: cy, x2: x + it.w - 3, y2: cy, stroke: accent, "stroke-width": 1.6, "stroke-linecap": "round" }));
      root.appendChild(svgEl("polygon", { points: `${x + it.w},${cy} ${x + it.w - 8},${cy - 4.5} ${x + it.w - 8},${cy + 4.5}`, fill: accent }));
      above.forEach((l, i) => root.appendChild(svgEl("text", { x: x + it.w / 2, y: cy - 8 - (above.length - 1 - i) * (SIZE + 2), fill: ink, "font-size": SIZE, "text-anchor": "middle" }, l)));
      below.forEach((l, i) => root.appendChild(svgEl("text", { x: x + it.w / 2, y: cy + 8 + SIZE + i * (SIZE + 2), fill: muted, "font-size": SIZE, "text-anchor": "middle" }, l)));
    } else {
      it.node.setAttribute("x", Math.round(x));
      it.node.setAttribute("y", Math.round((maxH - it.h) / 2));
      it.node.setAttribute("width", Math.round(it.w));
      it.node.setAttribute("height", Math.round(it.h));
      root.appendChild(it.node);
    }
    x += it.w + GAP;
  }
  root.setAttribute("style", "max-width:100%;height:auto");
  const used = usedModes.size === 1 ? [...usedModes][0] : usedModes.size ? "condensed" : mode;
  return { markup: root.outerHTML, width: total, height: maxH, mode: used };
}

// Agents: SMILES → common label ("OS(=O)(=O)O" → H₂SO₄); anything else is
// shown as written with subscripts ("H2SO4" → H₂SO₄, "heat" → Δ).
export const agentText = (agent) => (isValidSmiles(agent) ? agentLabel(agent) : prettyAgent(agent));

// ---- export helpers ---------------------------------------------------------
export function toStandaloneSvg(markup, { background = "#0d0f14" } = {}) {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  const svg = doc.documentElement;
  if (svg.nodeName !== "svg") return markup;
  const vb = (svg.getAttribute("viewBox") || "").split(/\s+/).map(Number);
  if (vb.length === 4) {
    svg.setAttribute("width", String(Math.round(vb[2])));
    svg.setAttribute("height", String(Math.round(vb[3])));
    const bg = doc.createElementNS(NS, "rect");
    ["x", "y", "width", "height"].forEach((a, i) => bg.setAttribute(a, String(vb[i])));
    bg.setAttribute("fill", background);
    svg.insertBefore(bg, svg.firstChild);
  }
  svg.removeAttribute("style");
  svg.setAttribute("xmlns", NS);
  return new XMLSerializer().serializeToString(svg);
}
