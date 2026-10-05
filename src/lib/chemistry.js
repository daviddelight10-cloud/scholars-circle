// Pure (DOM-free) chemistry helpers: a small SMILES reader that is just good
// enough for student-level molecules — formula, mass, hydrogen counts,
// condensed formulas, reaction-line parsing. Rendering lives in moleculeDraw.js.

const SUB = "₀₁₂₃₄₅₆₇₈₉";
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
export const subscript = (s) => String(s).replace(/\d/g, (d) => SUB[d]);
export const superscript = (s) => String(s).replace(/\d/g, (d) => SUP[d]);

const VALENCE = { B: [3], C: [4], N: [3, 5], O: [2], P: [3, 5], S: [2, 4, 6], F: [1], Cl: [1], Br: [1], I: [1] };

const MASS = {
  H: 1.008, Li: 6.94, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, Na: 22.99, Mg: 24.305, Al: 26.982,
  Si: 28.085, P: 30.974, S: 32.06, Cl: 35.45, K: 39.098, Ca: 40.078, Ti: 47.867, Cr: 51.996, Mn: 54.938,
  Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38, As: 74.922, Se: 78.971, Br: 79.904, Sr: 87.62,
  Pd: 106.42, Ag: 107.868, Sn: 118.71, I: 126.904, Ba: 137.327, Pt: 195.084, Au: 196.967, Hg: 200.592, Pb: 207.2,
};

const BOND = { "-": 1, "=": 2, "#": 3, ":": 1, "/": 1, "\\": 1, $: 4 };

// Parses a SMILES string into a lightweight graph. Returns null when the
// string is not valid SMILES (or uses features this reader does not support).
export function parseSmiles(input) {
  const s = String(input || "").trim();
  if (!s || /\s/.test(s)) return null;
  const atoms = [];
  const ringOpen = {};
  const stack = [];
  let prev = null, bond = null, hasRing = false, irregular = false, i = 0;

  const link = (a, b, o) => { atoms[a].nbrs.push({ idx: b, order: o }); atoms[b].nbrs.push({ idx: a, order: o }); };
  const addAtom = (a, start, end) => {
    a.idx = atoms.length; a.nbrs = []; a.start = start; a.end = end; a.ringEnd = end;
    atoms.push(a);
    if (prev !== null) link(prev, a.idx, bond ?? 1);
    bond = null; prev = a.idx;
  };

  while (i < s.length) {
    const c = s[i];
    if (c === "(") { if (prev === null) return null; stack.push(prev); i++; continue; }
    if (c === ")") { if (!stack.length) return null; prev = stack.pop(); i++; continue; }
    if (c === ".") { prev = null; bond = null; i++; continue; }
    if (BOND[c]) { bond = BOND[c]; i++; continue; }
    if (/\d/.test(c) || c === "%") {
      let n, len;
      if (c === "%") { n = s.slice(i + 1, i + 3); if (!/^\d\d$/.test(n)) return null; len = 3; } else { n = c; len = 1; }
      if (prev === null) return null;
      if (ringOpen[n]) {
        const o = ringOpen[n];
        if (o.idx === prev) return null;
        link(o.idx, prev, bond ?? o.order ?? 1);
        delete ringOpen[n];
      } else ringOpen[n] = { idx: prev, order: bond };
      bond = null; hasRing = true;
      if (atoms[prev].ringEnd === i) atoms[prev].ringEnd = i + len; else irregular = true;
      i += len;
      continue;
    }
    if (c === "[") {
      const j = s.indexOf("]", i);
      if (j < 0) return null;
      const m = /^(\d+)?([A-Z][a-z]?|[a-z]{1,2})(@{1,2})?(?:H(\d*))?(?:([+-]+)(\d*))?(?::(\d+))?$/.exec(s.slice(i + 1, j));
      if (!m) return null;
      const sym = m[2], arom = sym[0] === sym[0].toLowerCase();
      const el = arom ? sym[0].toUpperCase() + sym.slice(1) : sym;
      let charge = 0;
      if (m[5]) charge = (m[5][0] === "+" ? 1 : -1) * (m[6] ? +m[6] : m[5].length);
      addAtom({ el, arom, bracket: true, h: m[4] === undefined ? 0 : m[4] === "" ? 1 : +m[4], charge, chiral: !!m[3], iso: m[1] || "", map: m[7] || "" }, i, j + 1);
      i = j + 1;
      continue;
    }
    let el = null, arom = false;
    if (s.startsWith("Cl", i)) el = "Cl";
    else if (s.startsWith("Br", i)) el = "Br";
    else if ("BCNOPSFI".includes(c)) el = c;
    else if ("bcnops".includes(c)) { el = c.toUpperCase(); arom = true; }
    if (!el) return null;
    addAtom({ el, arom, bracket: false, h: null, charge: 0, chiral: false }, i, i + el.length);
    i += el.length;
  }
  if (stack.length || Object.keys(ringOpen).length || !atoms.length) return null;

  for (const a of atoms) {
    const sum = a.nbrs.reduce((t, n) => t + n.order, 0);
    if (a.bracket) a.hImp = a.h;
    else {
      const vals = VALENCE[a.el] || [];
      a.hImp = 0;
      if (vals.length && sum > Math.max(...vals)) a.overValence = true;
      if (a.arom && ["C", "N", "B", "P"].includes(a.el)) {
        const v = vals.find((x) => x >= sum + 1);
        if (v !== undefined) { a.hImp = v - sum - 1; continue; }
      }
      const v = vals.find((x) => x >= sum);
      a.hImp = v === undefined ? 0 : v - sum;
    }
  }
  for (const a of atoms) {
    a.hExplicitNbrs = a.nbrs.filter((n) => atoms[n.idx].el === "H" && atoms[n.idx].bracket).length;
    a.hTotal = a.el === "H" ? 0 : a.hImp + a.hExplicitNbrs;
    a.heavy = a.nbrs.filter((n) => atoms[n.idx].el !== "H");
  }
  return { atoms, hasRing, irregular, source: s, valid: !atoms.some((a) => a.overValence) };
}

// True only for SMILES this reader fully understands: balanced branches and
// rings, known atoms, and no impossible valences (e.g. a 5-bond carbon).
export function isValidSmiles(smiles) {
  const g = parseSmiles(smiles);
  return !!g && g.valid;
}

export function atomCounts(g) {
  const counts = {};
  const add = (el, n) => { if (n > 0) counts[el] = (counts[el] || 0) + n; };
  for (const a of g.atoms) {
    if (a.el === "H") add("H", 1);
    else { add(a.el, 1); add("H", a.hImp); }
  }
  return counts;
}

export function hillFormula(counts) {
  const els = Object.keys(counts);
  const hasC = "C" in counts;
  const order = els.sort((a, b) => {
    if (hasC) {
      if (a === "C") return -1; if (b === "C") return 1;
      if (a === "H") return -1; if (b === "H") return 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return order.map((e) => e + (counts[e] > 1 ? counts[e] : "")).join("");
}

export function molarMass(counts) {
  let m = 0;
  for (const [el, n] of Object.entries(counts)) {
    if (!(el in MASS)) return null;
    m += MASS[el] * n;
  }
  return m;
}

// Everything the UI wants to show about a molecule, or null if unparseable.
export function analyzeSmiles(smiles) {
  const g = parseSmiles(smiles);
  if (!g) return null;
  const counts = atomCounts(g);
  const heavy = g.atoms.filter((a) => a.el !== "H").length;
  return {
    graph: g,
    counts,
    formula: hillFormula(counts),
    mass: molarMass(counts),
    heavy,
    hasRing: g.hasRing,
    aromatic: g.atoms.some((a) => a.arom),
    charged: g.atoms.some((a) => a.charge),
    chiral: g.atoms.some((a) => a.chiral) || /[/\\]/.test(g.source),
    components: g.source.split(".").length,
  };
}

// Reads "C2H6O", "C₂H₆O", "H2SO4" … into element counts. Returns null if the
// text is not a plain formula (so callers skip the cross-check).
export function parseFormula(text) {
  let t = String(text || "").replace(/[\s·]/g, "");
  t = t.replace(/[₀-₉]/g, (d) => String(SUB.indexOf(d))).replace(/[⁺⁻]|[+-]\d*$/g, "");
  if (!t) return null;
  const counts = {};
  const re = /([A-Z][a-z]?)(\d*)/g;
  let used = 0, m;
  while ((m = re.exec(t))) {
    used += m[0].length;
    counts[m[1]] = (counts[m[1]] || 0) + (m[2] ? +m[2] : 1);
  }
  return used === t.length ? counts : null;
}

export function sameCounts(a, b) {
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

// Textbook condensed formula for acyclic molecules, e.g. CH₃CH₂OH or
// CH₃C(=O)OH. Returns null for rings, charges, salts or very large molecules.
export function condensedFormula(g) {
  const atoms = g.atoms;
  const heavy = atoms.filter((a) => a.el !== "H");
  if (!heavy.length || heavy.length > 24 || g.hasRing || g.source.includes(".")) return null;
  if (atoms.some((a) => a.charge || a.arom)) return null;
  const label = (a) => a.el + (a.hTotal > 0 ? "H" + (a.hTotal > 1 ? subscript(a.hTotal) : "") : "");
  const size = {};
  const measure = (i, parent) => {
    let n = 1;
    for (const nb of atoms[i].heavy) if (nb.idx !== parent) n += measure(nb.idx, i);
    return (size[i] = n);
  };
  const terminals = heavy.filter((a) => a.heavy.length <= 1);
  const start = (terminals.filter((a) => a.el === "C").sort((a, b) => b.hTotal - a.hTotal)[0] || terminals[0] || heavy[0]).idx;
  measure(start, -1);
  const emit = (i, parent) => {
    let out = label(atoms[i]);
    const kids = atoms[i].heavy.filter((n) => n.idx !== parent).sort((a, b) => size[a.idx] - size[b.idx]);
    kids.forEach((k, n) => {
      const sym = k.order === 2 ? "=" : k.order === 3 ? "≡" : "";
      const inner = sym + emit(k.idx, i);
      out += n < kids.length - 1 ? `(${inner})` : inner;
    });
    return out;
  };
  return emit(start, -1);
}

// Re-writes a SMILES string with every implicit hydrogen spelled out as a
// "([H])" branch. Not offered for aromatic or stereo SMILES (returns null).
export function expandHydrogens(smiles) {
  const g = parseSmiles(smiles);
  if (!g || g.irregular || g.atoms.some((a) => a.arom || a.chiral)) return null;
  const s = g.source;
  const inserts = [];
  let out = "", last = 0;
  for (const a of g.atoms) {
    if (a.el === "H") continue;
    const n = a.hImp;
    if (a.bracket && n > 0) {
      const bracket = `[${a.iso}${a.el}${a.charge ? (a.charge > 0 ? "+" : "-") + (Math.abs(a.charge) > 1 ? Math.abs(a.charge) : "") : ""}${a.map ? ":" + a.map : ""}]`;
      inserts.push({ from: a.start, to: a.end, text: bracket + "([H])".repeat(n) });
    } else if (n > 0) {
      inserts.push({ from: a.ringEnd, to: a.ringEnd, text: "([H])".repeat(n) });
    }
  }
  inserts.sort((x, y) => x.from - y.from);
  for (const ins of inserts) {
    out += s.slice(last, ins.from) + ins.text;
    last = ins.to;
  }
  return out + s.slice(last);
}

export const stripAtomMaps = (s) => String(s || "").replace(/\[([^\]]*?):\d+\]/g, "[$1]");

// Reaction line → steps. Accepts reaction SMILES (a>b>c, a>>c), arrow text
// (A -> B, A → B, A => B) and "A + B" with spaces. Species are split on "."
// or " + " (never a bare "+", which is a SMILES charge).
export function parseReactionLine(line) {
  let l = String(line || "").trim();
  if (!l) return null;
  l = l.replace(/-{1,2}>|=>|→|⟶|⇒/g, ">>");
  const parts = l.split(">");
  if (parts.length < 3) return null;
  const species = (t) => t.split(/\s+\+\s+|\./).map((x) => x.trim()).filter(Boolean);
  const steps = [];
  if (parts.length === 3) steps.push({ reactants: species(parts[0]), agents: species(parts[1]), products: species(parts[2]) });
  else if (parts.length % 2 === 1 && parts.every((p, k) => k % 2 === 0 || p === "")) {
    const mols = parts.filter((_, k) => k % 2 === 0);
    for (let k = 0; k + 1 < mols.length; k++) steps.push({ reactants: species(mols[k]), agents: [], products: species(mols[k + 1]) });
  } else return null;
  return steps.every((st) => st.reactants.length && st.products.length) ? steps : null;
}

const FORMULA_LINE = /^formula\s*:\s*(.+)$/i;
const LABEL_PREFIX = /^(name|smiles)\s*:\s*/i;

// ```smiles block body → { entries: [{ raw, name, formula }], caption }.
// Accepts "SMILES / Name / Formula: …", name-first order, "SMILES | Name"
// per line, and several bare SMILES lines (one molecule each).
export function parseMoleculeBlock(body) {
  const lines = String(body || "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return { entries: [], caption: "" };
  if (lines.some((l) => l.includes("|"))) {
    const piped = lines.filter((l) => l.includes("|"));
    return {
      entries: piped.map((l) => { const [raw, name = "", formula = ""] = l.split("|").map((x) => x.trim()); return { raw, name, formula: formula.replace(/^formula\s*:\s*/i, "") }; }),
      caption: lines.filter((l) => !l.includes("|")).join(" "),
    };
  }
  let formula = "";
  const rest = [];
  for (const l of lines) {
    const m = FORMULA_LINE.exec(l);
    if (m) formula = m[1]; else rest.push(l.replace(LABEL_PREFIX, ""));
  }
  const smilesLines = rest.filter((l) => isValidSmiles(l));
  if (smilesLines.length > 1) {
    const nameFirst = !isValidSmiles(rest[0]);
    const entries = [];
    let pending = "";
    for (const l of rest) {
      if (isValidSmiles(l)) {
        entries.push({ raw: l, name: nameFirst ? pending : "", formula: "" });
        pending = "";
      } else if (nameFirst) pending = l;
      else if (entries.length && !entries[entries.length - 1].name) entries[entries.length - 1].name = l;
    }
    return { entries, caption: "" };
  }
  let idx = rest.findIndex((l) => isValidSmiles(l));
  if (idx < 0) idx = 0;
  return { entries: [{ raw: rest[idx] || "", name: rest.filter((_, i) => i !== idx).join(" "), formula }], caption: "" };
}

// ```reaction block body → { steps: [{ reactants, agents, products, conditions }], caption, raw }.
export function parseReactionBlock(body) {
  const lines = String(body || "").split("\n").map((l) => l.trim()).filter(Boolean);
  const steps = [];
  const caption = [];
  let pendingConditions = "";
  for (const l of lines) {
    const cond = /^(?:conditions?|cond|reagents?)\s*:\s*(.+)$/i.exec(l);
    if (cond) {
      if (steps.length) steps[steps.length - 1].conditions = cond[1]; else pendingConditions = cond[1];
      continue;
    }
    const parsed = parseReactionLine(l);
    if (parsed) parsed.forEach((st) => steps.push({ ...st, conditions: "" }));
    else caption.push(l.replace(/^name\s*:\s*/i, ""));
  }
  if (steps.length && pendingConditions) steps[0].conditions = pendingConditions;
  return { steps, caption: caption.join(" "), raw: lines.join("\n") };
}

// Friendly text for reaction agents/conditions: "H2SO4" → "H₂SO₄".
export function prettyAgent(text) {
  return String(text || "").replace(/([A-Za-z)\]])(\d+)/g, (_, a, n) => a + subscript(n)).replace(/\bheat\b/i, "Δ");
}

const AGENT_BY_HILL = {
  H2O4S: "H₂SO₄", ClH: "HCl", HNO3: "HNO₃", H2O: "H₂O", HNaO: "NaOH", HKO: "KOH", H3O4P: "H₃PO₄",
  H2O2: "H₂O₂", CO2: "CO₂", H3N: "NH₃", H2: "H₂", Br2: "Br₂", Cl2: "Cl₂", I2: "I₂", O2: "O₂",
  C2H4O2: "CH₃COOH", CH4O: "CH₃OH", C2H6O: "C₂H₅OH", Pd: "Pd", Pt: "Pt", Ni: "Ni", Cu: "Cu",
};

// A SMILES agent → its common text label ("OS(=O)(=O)O" → "H₂SO₄").
export function agentLabel(smiles) {
  const info = analyzeSmiles(smiles);
  if (!info) return prettyAgent(smiles);
  return AGENT_BY_HILL[info.formula] || subscript(info.formula);
}
