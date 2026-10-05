// Textbook "expanded structural formula" for simple acyclic molecules: the
// longest carbon chain runs left-to-right, hydrogens sit above/below each
// atom, and small groups (OH, NH₂, CH₃, =O) hang off the chain. Pure string
// output (no DOM). Returns null when the molecule is not a good fit — callers
// then fall back to the zig-zag drawing.

import { parseSmiles, subscript } from "./chemistry.js";

const U = 46;
const DIRS = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] };
const PERP = { R: ["U", "D"], L: ["U", "D"], U: ["R", "L"], D: ["R", "L"] };

const COLORS = {
  dark: { C: "#EDEFF5", H: "#AEB7C8", O: "#FF6B6B", N: "#5AA9FF", S: "#F1C40F", P: "#FF9F43", F: "#2ECC71", Cl: "#1ABC9C", Br: "#E67E22", I: "#A569BD", bond: "#9AA3B5" },
  light: { C: "#1F2430", H: "#667085", O: "#D63031", N: "#1D6FD6", S: "#B7950B", P: "#D35400", F: "#1E8449", Cl: "#117A65", Br: "#AF601A", I: "#7D3C98", bond: "#667085" },
};

const groupLabel = (el, h, reversed) => {
  const hs = h > 0 ? "H" + (h > 1 ? subscript(h) : "") : "";
  return reversed ? hs + el : el + hs;
};

export function renderExpandedSvg(smiles, { light = false, maxHeavy = 12 } = {}) {
  const g = parseSmiles(smiles);
  if (!g || g.hasRing || g.source.includes(".")) return null;
  const atoms = g.atoms;
  if (atoms.some((a) => a.arom || a.charge || a.el === "H" && a.nbrs.length !== 1)) return null;
  const heavy = atoms.filter((a) => a.el !== "H").map((a) => a.idx);
  if (!heavy.length || heavy.length > maxHeavy) return null;
  if (atoms.some((a) => a.heavy.length + a.hTotal > 4)) return null;

  const pathBetween = (from, to) => {
    const prev = { [from]: -1 };
    const q = [from];
    while (q.length) {
      const x = q.shift();
      for (const n of atoms[x].heavy) if (!(n.idx in prev)) { prev[n.idx] = x; q.push(n.idx); }
    }
    const p = [];
    for (let x = to; x !== -1; x = prev[x]) p.push(x);
    return p.reverse();
  };
  const order = (a, b) => atoms[a].nbrs.find((n) => n.idx === b)?.order || 1;
  const endPenalty = (p) => [p[0], p[p.length - 1]].reduce((t, x) => t + (p.length > 1 && order(x, p[x === p[0] ? 1 : p.length - 2]) > 1 ? 1 : 0), 0);

  let path = [heavy[0]];
  let bestKey = [1, 0, 0];
  const beats = (x, y) => { for (let n = 0; n < x.length; n++) if (x[n] !== y[n]) return x[n] > y[n]; return false; };
  for (const a of heavy) for (const b of heavy) {
    if (a > b) continue;
    const p = pathBetween(a, b);
    const key = [p.length, -endPenalty(p), p.filter((x) => atoms[x].el === "C").length];
    if (beats(key, bestKey)) { bestKey = key; path = p; }
  }
  const inPath = new Set(path);

  const nodes = [], bonds = [], occ = new Set();
  const k = (x, y) => x + "," + y;
  const addNode = (x, y, label, el, kind, anchor) => { nodes.push({ x, y, label, el, kind, anchor }); occ.add(k(x, y)); return nodes.length - 1; };

  const size = {};
  const measure = (i, parent) => { let n = 1; for (const nb of atoms[i].heavy) if (nb.idx !== parent) n += measure(nb.idx, i); return (size[i] = n); };
  measure(path[0], -1);

  const place = (parentNode, px, py, dir, atomIdx, ord) => {
    const [dx, dy] = DIRS[dir];
    const x = px + dx, y = py + dy;
    if (occ.has(k(x, y))) return false;
    if (atomIdx === "H") {
      const id = addNode(x, y, "H", "H", "atom", "middle");
      bonds.push({ a: parentNode, b: id, order: 1 });
      return true;
    }
    return placeBranch(parentNode, x, y, dir, atomIdx, ord);
  };
  const placeBranch = (parentNode, x, y, dir, atomIdx, ord) => {
    const at = atoms[atomIdx];
    const parentIdx = nodes[parentNode].atom;
    const kids = at.heavy.filter((n) => n.idx !== parentIdx);
    if (!kids.length) {
      const reversed = dir === "L";
      const id = addNode(x, y, groupLabel(at.el, at.hTotal, reversed), at.el, "group", reversed ? "end" : "start");
      nodes[id].atom = atomIdx;
      bonds.push({ a: parentNode, b: id, order: ord });
      return true;
    }
    const id = addNode(x, y, at.el, at.el, "atom", "middle");
    nodes[id].atom = atomIdx;
    bonds.push({ a: parentNode, b: id, order: ord });
    const slots = [dir, ...PERP[dir]];
    return fill(id, x, y, slots, slots, kids, at.hTotal);
  };
  const fill = (id, x, y, heavySlots, hSlots, kids, hCount) => {
    const used = new Set();
    const free = (d) => !used.has(d) && !occ.has(k(x + DIRS[d][0], y + DIRS[d][1]));
    const sorted = [...kids].sort((a, b) => size[b.idx] - size[a.idx]);
    for (const kid of sorted) {
      const d = heavySlots.find(free);
      if (!d) return false;
      used.add(d);
      if (!place(id, x, y, d, kid.idx, kid.order)) return false;
    }
    for (let n = 0; n < hCount; n++) {
      const d = hSlots.find(free);
      if (!d) return false;
      used.add(d);
      if (!place(id, x, y, d, "H", 1)) return false;
    }
    return true;
  };

  // main chain
  const chainIds = [];
  for (let i = 0; i < path.length; i++) {
    const at = atoms[path[i]];
    const isEnd = i === 0 || i === path.length - 1;
    const kidsOff = at.heavy.filter((n) => !inPath.has(n.idx));
    let id;
    if (isEnd && path.length > 1 && !kidsOff.length && at.el !== "C") {
      const reversed = i === 0;
      id = addNode(i, 0, groupLabel(at.el, at.hTotal, reversed), at.el, "group", reversed ? "end" : "start");
    } else if (path.length === 1 && at.el !== "C" && !kidsOff.length) {
      id = addNode(0, 0, groupLabel(at.el, at.hTotal, true), at.el, "group", "end");
    } else id = addNode(i, 0, at.el, at.el, "atom", "middle");
    nodes[id].atom = path[i];
    chainIds.push(id);
    if (i > 0) bonds.push({ a: chainIds[i - 1], b: id, order: order(path[i - 1], path[i]) });
  }
  for (let i = 0; i < path.length; i++) {
    const at = atoms[path[i]];
    if (nodes[chainIds[i]].kind === "group") continue;
    const kids = at.heavy.filter((n) => !inPath.has(n.idx));
    const vert = i % 2 ? ["D", "U"] : ["U", "D"];
    let hSlots;
    let heavySlots = vert;
    if (path.length === 1) hSlots = ["L", "R", "U", "D"], heavySlots = ["U", "D", "L", "R"];
    else if (i === 0) hSlots = ["L", ...vert], heavySlots = [...vert, "L"];
    else if (i === path.length - 1) hSlots = ["R", ...vert], heavySlots = [...vert, "R"];
    else hSlots = vert;
    if (!fill(chainIds[i], i, 0, heavySlots, hSlots, kids, at.hTotal)) return null;
  }

  const C = light ? COLORS.light : COLORS.dark;
  const halfW = (n) => (n.kind === "group" ? n.label.length * 5 + 6 : 8);
  const textX = (n) => (n.anchor === "start" ? n.x * U - 5.5 : n.anchor === "end" ? n.x * U + 5.5 : n.x * U);
  const pad = (n) => (n.el === "H" ? 8 : 10);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    const left = n.anchor === "end" ? n.x * U - halfW(n) * 2 + 6 : n.x * U - 10;
    const right = n.anchor === "start" ? n.x * U + halfW(n) * 2 - 6 : n.x * U + 10;
    minX = Math.min(minX, left); maxX = Math.max(maxX, right);
    minY = Math.min(minY, n.y * U - 12); maxY = Math.max(maxY, n.y * U + 12);
  }
  const M = 12;
  minX -= M; maxX += M; minY -= M; maxY += M;
  const W = Math.round(maxX - minX), H = Math.round(maxY - minY);

  let body = "";
  for (const b of bonds) {
    const A = nodes[b.a], B = nodes[b.b];
    const ax = A.x * U, ay = A.y * U, bx = B.x * U, by = B.y * U;
    const len = Math.hypot(bx - ax, by - ay);
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const sx = ax + ux * pad(A), sy = ay + uy * pad(A);
    const ex = bx - ux * pad(B), ey = by - uy * pad(B);
    const nx = -uy, ny = ux;
    const offs = b.order === 2 ? [-2.6, 2.6] : b.order === 3 ? [-4, 0, 4] : [0];
    for (const o of offs) {
      body += `<line x1="${(sx + nx * o).toFixed(1)}" y1="${(sy + ny * o).toFixed(1)}" x2="${(ex + nx * o).toFixed(1)}" y2="${(ey + ny * o).toFixed(1)}" stroke="${C.bond}" stroke-width="1.7" stroke-linecap="round"/>`;
    }
  }
  for (const n of nodes) {
    const fill = C[n.el] || C.C;
    const anchor = n.anchor === "end" ? "end" : n.anchor === "start" ? "start" : "middle";
    body += `<text x="${textX(n).toFixed(1)}" y="${(n.y * U).toFixed(1)}" fill="${fill}" font-size="${n.el === "H" ? 15 : 17}" font-weight="600" text-anchor="${anchor}" dominant-baseline="central">${n.label}</text>`;
  }
  const markup =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX.toFixed(1)} ${minY.toFixed(1)} ${W} ${H}" width="${W}" height="${H}" ` +
    `font-family="Arial, Helvetica, sans-serif" style="width:${W}px;max-width:100%;height:auto">${body}</svg>`;
  return { markup, width: W, height: H };
}
