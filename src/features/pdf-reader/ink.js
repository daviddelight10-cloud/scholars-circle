// Ink geometry helpers — pure functions for pen/marker/shape strokes.
// Points are {x, y} in the coordinate space of the caller (screen px or
// PDF units); pen points may also carry `p` (stylus pressure 0..1) and
// `v` (normalized draw speed 0..1) captured at pointer time.

// Catmull-ish smoothing: midpoint quadratic chain through the points.
export function smoothPath(pts) {
  if (!pts?.length) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i + 1].x) / 2;
    const my = (pts[i].y + pts[i + 1].y) / 2;
    d += ` Q ${pts[i].x},${pts[i].y} ${mx},${my}`;
  }
  const last = pts[pts.length - 1];
  d += ` L ${last.x},${last.y}`;
  return d;
}

// Per-point radius profile: tip envelope × pressure × velocity.
// Envelope ramps in over the first ~12% and tapers out over the last ~30%
// so strokes start and end like felt-tip ink even without a stylus.
export function strokeWidths(pts, base) {
  const n = pts.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const t = n <= 1 ? 0.5 : i / (n - 1);
    const env = Math.min(1, t / 0.12) * Math.min(1, (1 - t) / 0.3);
    const press = pts[i].p ?? 0.5;
    const vel = pts[i].v ?? 0.5;
    out[i] = Math.max(0.3, base * (0.3 + 0.7 * env) * (0.65 + 0.7 * press) * (1.15 - 0.6 * vel));
  }
  return out;
}

// Filled outline polygon for a tapered stroke — perpendicular offsets on
// each side of the spine, joined into one closed path.
export function taperedOutline(pts, base) {
  if (!pts || pts.length < 2) return null;
  const n = pts.length;
  const ws = strokeWidths(pts, base);
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(n - 1, i + 1)];
    let dx = next.x - prev.x, dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    const r = ws[i] / 2;
    left.push([p.x - dy * r, p.y + dx * r]);
    right.unshift([p.x + dy * r, p.y - dx * r]);
  }
  return "M " + left.concat(right).map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" L ") + " Z";
}

// Single-tap dot — a tap with the pen stamps a filled circle.
export function dotPath(p, r) {
  return `M ${p.x - r},${p.y} a ${r},${r} 0 1,0 ${r * 2},0 a ${r},${r} 0 1,0 ${-r * 2},0`;
}

// Arrowhead polygon at the end point of a line.
export function arrowHeadPath(a, b, w) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const hl = Math.max(7, w * 3), hw = Math.max(4.5, w * 2);
  const bx = b.x - ux * hl, by = b.y - uy * hl;
  return `M ${b.x},${b.y} L ${bx - uy * hw},${by + ux * hw} L ${bx + uy * hw},${by - ux * hw} Z`;
}

// Partial erase: mark stroke points inside `radius` of any erase point,
// then split the survivors into contiguous runs (each ≥ 2 points).
export function eraseSplit(pts, erasePts, radius) {
  if (!pts?.length) return [];
  const hit = new Array(pts.length).fill(false);
  for (const e of erasePts) {
    for (let i = 0; i < pts.length; i++) {
      if (!hit[i] && Math.hypot(pts[i].x - e.x, pts[i].y - e.y) < radius) hit[i] = true;
    }
  }
  const runs = [];
  let cur = [];
  for (let i = 0; i < pts.length; i++) {
    if (hit[i]) {
      if (cur.length >= 2) runs.push(cur);
      cur = [];
    } else cur.push(pts[i]);
  }
  if (cur.length >= 2) runs.push(cur);
  return runs;
}
