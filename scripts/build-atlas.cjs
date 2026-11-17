#!/usr/bin/env node
/*
 * Build the embedded Anatomy Atlas for Scholar's Circle.
 *
 * Usage:  node scripts/build-atlas.cjs <path-to-atlas-index.html>
 *
 * Reads the standalone atlas index.html (from the anatomy-atlas repo) and
 * writes:
 *   public/atlas/index.html  — the atlas app, retuned to SC's theme, with
 *                              postMessage bridge hooks and a lazy model loader
 *   public/atlas/model.b64   — the ~30MB gzip'd Z-Anatomy GLB as base64,
 *                              fetched on demand by the 3D explorer
 *
 * Edits applied:
 *   1. Drops CC *NonCommercial* Sketchfab models from ATLAS_MODELS — Scholar's
 *      Circle has paid plans, so NC content can't ship. (CC BY / CC BY-SA kept.)
 *   2. Extracts window.ATLAS_GLB into model.b64; loadBodyGlb() fetches it the
 *      first time the user opens the 3D explorer.
 *   3. Retunes the dark/light palettes + hardcoded 3D-viewer colors to the
 *      Scholar's Circle warm-black + gold theme, switches the font to Inter.
 *   4. Adds the SC bridge: posts atlas:quiz-correct / atlas:ready to the
 *      parent frame, listens for sc-theme messages, falls back to the
 *      sc-appearance localStorage key when atlas-theme is unset.
 */
const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) {
  console.error("usage: node scripts/build-atlas.cjs <path-to-atlas-index.html>");
  process.exit(1);
}
const outDir = path.join(__dirname, "..", "public", "atlas");
fs.mkdirSync(outDir, { recursive: true });

let html = fs.readFileSync(src, "utf8").replace(/\r\n/g, "\n");
const origLen = html.length;
const report = [];
const must = (cond, msg) => { if (!cond) { console.error("FATAL: " + msg); process.exit(1); } };

function replaceOnce(haystack, needle, replacement, label) {
  const i = haystack.indexOf(needle);
  must(i !== -1, `pattern not found: ${label}`);
  report.push(`${label}: 1 edit`);
  return haystack.slice(0, i) + replacement + haystack.slice(i + needle.length);
}

/* ---------- 1. Drop NonCommercial Sketchfab models ---------- */
const modelsMatch = html.match(/window\.ATLAS_MODELS = \{[\s\S]*?\n\};/);
must(modelsMatch, "ATLAS_MODELS block not found");
const kept = [], dropped = [];
for (const m of modelsMatch[0].matchAll(/(\s*)"([\w-]+)": \{[\s\S]*?"license": "([^"]+)"[\s\S]*?\},?/g)) {
  if (m[3].includes("NonCommercial")) dropped.push(m[2]);
  else kept.push(m[0]);
}
// Entries are self-contained text (leading ws + trailing ","), so rejoining
// the kept ones preserves valid object syntax.
const rebuiltModels = "window.ATLAS_MODELS = {" + kept.join("") + "\n};";
html = html.replace(modelsMatch[0], rebuiltModels);
report.push(`ATLAS_MODELS: dropped ${dropped.length} NC models (${dropped.join(", ")}), kept ${kept.length}`);

/* ---------- 2. Extract the GLB ---------- */
const glbMatch = html.match(/window\.ATLAS_GLB = "([^"]+)";\s*\n/);
must(glbMatch, "ATLAS_GLB line not found");
fs.writeFileSync(path.join(outDir, "model.b64"), glbMatch[1]);
html = html.replace(glbMatch[0],
  '// GLB moved to ./model.b64 — fetched lazily by loadBodyGlb() on first 3D use.\n');
report.push(`GLB extracted -> model.b64 (${(glbMatch[1].length / 1e6).toFixed(1)}MB base64)`);

html = replaceOnce(html,
  `  prog("Unpacking the original Z-Anatomy body — a few seconds the first time…");\n` +
  `  const bin = Uint8Array.from(atob(window.ATLAS_GLB), c=>c.charCodeAt(0));`,
  `  if(!window.ATLAS_GLB){\n` +
  `    prog("Downloading the 3D body — a large one-time download, then it's cached…");\n` +
  `    const r = await fetch("model.b64");\n` +
  `    if(!r.ok) throw new Error("model.b64 download failed: "+r.status);\n` +
  `    window.ATLAS_GLB = await r.text();\n` +
  `  }\n` +
  `  prog("Unpacking the original Z-Anatomy body — a few seconds the first time…");\n` +
  `  const bin = Uint8Array.from(atob(window.ATLAS_GLB), c=>c.charCodeAt(0));`,
  "lazy GLB fetch in loadBodyGlb");

/* ---------- 3a. Font: Inter (loaded by the parent page's stylesheet too) ---------- */
html = replaceOnce(html,
  `<link rel="preconnect" href="https://upload.wikimedia.org">`,
  `<link rel="preconnect" href="https://upload.wikimedia.org">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">`,
  "Google Fonts links");
html = replaceOnce(html,
  `--font: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;`,
  `--font: "Inter", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;`,
  "font stack");

/* ---------- 3b. Theme palettes -> Scholar's Circle ---------- */
html = replaceOnce(html,
`[data-theme="dark"]{
  --bg:#0b1220; --bg2:#0f1a2e; --panel:#111f38; --panel2:#16264a;
  --text:#e8eef8; --text2:#9fb2cd; --text3:#6b7f9d;
  --border:#22345c; --border2:#2c4270;
  --accent:#4cc9f0; --accent2:#7dd3fc; --accent-soft:rgba(76,201,240,.14);
  --hl:rgba(76,201,240,.28);
  --card:#101d36; --card-h:#152647;
  --good:#34d399; --warn:#fbbf24; --bad:#f87171;
  --shadow:0 8px 28px rgba(0,0,0,.45);
  --side:#0d1830;
}`,
`[data-theme="dark"]{
  --bg:#0a0a0a; --bg2:#111111; --panel:#141414; --panel2:#1a1a1a;
  --text:#e8e8e8; --text2:#a3a3a3; --text3:#777777;
  --border:#2a2a2a; --border2:#3d3d3d;
  --accent:#ffd60a; --accent2:#f2a900; --accent-soft:rgba(255,214,10,.13);
  --hl:rgba(255,214,10,.26);
  --card:#141414; --card-h:#1c1c1c;
  --good:#3ddc84; --warn:#f2a900; --bad:#ff5d6c;
  --shadow:0 8px 28px rgba(0,0,0,.5);
  --side:#0f0f0f;
}`,
"dark palette");

html = replaceOnce(html,
`[data-theme="light"]{
  --bg:#f2f6fb; --bg2:#e8eef7; --panel:#ffffff; --panel2:#eef3fa;
  --text:#17233b; --text2:#4a5f80; --text3:#7c8da8;
  --border:#d5e0ee; --border2:#b9cade;
  --accent:#0e7fb8; --accent2:#0a6aa0; --accent-soft:rgba(14,127,184,.12);
  --hl:rgba(14,127,184,.25);
  --card:#ffffff; --card-h:#f3f8fd;
  --good:#0b9c6c; --warn:#b57e02; --bad:#c93a3a;
  --shadow:0 8px 24px rgba(30,50,90,.12);
  --side:#ffffff;
}`,
`[data-theme="light"]{
  --bg:#ece7d8; --bg2:#e6e0cf; --panel:#fdfbf3; --panel2:#f0ebdf;
  --text:#1a1814; --text2:#4a453a; --text3:#6b6557;
  --border:#ddd5bf; --border2:#cfc5ab;
  --accent:#a07d00; --accent2:#c1910a; --accent-soft:rgba(176,141,10,.12);
  --hl:rgba(176,141,10,.22);
  --card:#fdfbf3; --card-h:#f5efe0;
  --good:#159c63; --warn:#b57e02; --bad:#d92d20;
  --shadow:0 8px 24px rgba(80,65,25,.12);
  --side:#fdfbf3;
}`,
"light palette");

/* ---------- 3c. Hero: warm dark gradient matching the app's home hero ---------- */
const heroFrom = `background:linear-gradient(120deg,#0d2b45 0%,#123a5c 45%,#0f5a74 100%)`;
const heroTo = `background:radial-gradient(120% 100% at 100% 0%, #3A3022 0%, transparent 55%),linear-gradient(160deg,#2D2921,#201E19)`;
const heroCount = html.split(heroFrom).length - 1;
must(heroCount >= 1, "hero gradient not found");
html = html.split(heroFrom).join(heroTo);
report.push(`hero gradient: ${heroCount} edits`);

const heroTextMap = [
  [`color:#eaf6ff`, `color:#fbf9f3`],
  [`color:#c8e3f5`, `color:#c9c2b0`],
  [`color:#06283a`, `color:#141414`],          // ink on gold .btn.primary
];
for (const [a, b] of heroTextMap) {
  const n = html.split(a).length - 1;
  html = html.split(a).join(b);
  report.push(`hero/btn ${a} -> ${b}: ${n} edits`);
}

/* ---------- 3d. Hardcoded navy colors in the 3D explorer / viewer UI ---------- */
const colorMap = {
  "#0d1526": "#0a0a0a",   // 3D stage bg
  "#1a2440": "#141414",   // load gradient end
  "#121c36": "#1a1a1a",   // load gradient start (hover)
  "#22305a": "#242424",   // load gradient hover end
  "#111f38": "#1a1a1a",   // tooltip bg
  "#16264a": "#242424",   // hover rows / close btn
  "#2c4270": "#3d3d3d",   // stage borders
  "#43556f": "#555555",
  "#3b5a8a": "#3d3d3d",   // spinner track
  "#1c4d80": "rgba(255,214,10,.16)", // "on" toggle bg -> gold tint
  "#3b7ab8": "rgba(255,214,10,.55)", // "on" toggle border
  "#4f9dd4": "#ffd60a",   // range accent
  "#7fc0ff": "#ffd60a",   // leader-line dot
  "#7cc4ff": "#ffd60a",   // link on dark
  "#9fd8f5": "#ffd60a",
  "#7dd3fc": "#ffd60a",   // default badge accent (CSS only — JS replaced below is none)
  "#cfe0f5": "#e8e8e8",
  "#eaf1ff": "#e8e8e8",
  "#eaf5ff": "#e8e8e8",
  "#eaf2ff": "#e8e8e8",
  "#dfe7f5": "#e8e8e8",
  "#9fb0d0": "#a3a3a3",
  "#8fa5c8": "#a3a3a3",
  "#9fb4d4": "#a3a3a3",
  "#c6d5ee": "#c9c2b0",
  "rgba(17,31,56,.85)": "rgba(20,20,20,.88)",
  "rgba(13,21,38,.82)": "rgba(18,18,18,.85)",
  "rgba(15,23,42,.94)": "rgba(15,15,15,.94)",
  "rgba(15,23,42,.96)": "rgba(15,15,15,.96)",
  "rgba(22,34,60,.6)": "rgba(40,40,40,.6)",
  "rgba(90,140,200,.45)": "rgba(255,214,10,.4)",
  "rgba(140,190,255,.7)": "rgba(255,214,10,.55)",
  "rgba(4,10,20,.9)": "rgba(10,10,10,.9)",
};
// Apply inside the <style> block only — never touch ATLAS_META system colors in JS.
const cssStart = html.indexOf("<style>"), cssEnd = html.indexOf("</style>");
let css = html.slice(cssStart, cssEnd);
for (const [a, b] of Object.entries(colorMap)) {
  const n = css.split(a).length - 1;
  if (n) { css = css.split(a).join(b); report.push(`css ${a} -> ${b}: ${n}`); }
}
html = html.slice(0, cssStart) + css + html.slice(cssEnd);

/* ---------- 3e. 3D picking glow: blue -> gold ---------- */
html = html.replace(/glow\(m,0x2c6d9e\)/g, "glow(m,0x8a6d00)");

/* ---------- 4a. Theme seed: fall back to Scholar's Circle's sc-appearance key ---------- */
html = replaceOnce(html,
  `const saved = localStorage.getItem("atlas-theme");`,
  `const saved = localStorage.getItem("atlas-theme") ||
  (()=>{ const p = localStorage.getItem("sc-appearance");
    return (p==="light"||p==="dark") ? p :
      (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); })();`,
  "sc-appearance theme fallback");

/* ---------- 4b. Quiz -> parent XP bridge ---------- */
html = replaceOnce(html,
  `quiz.asked++; if(right){quiz.score++; quiz.streak=(quiz.streak||0)+1;} else quiz.streak=0;`,
  `quiz.asked++; if(right){quiz.score++; quiz.streak=(quiz.streak||0)+1;} else quiz.streak=0;
    try{ if(right && window.parent !== window) parent.postMessage({type:"atlas:quiz-correct", id:d.id}, location.origin); }catch(e){}`,
  "quiz postMessage hook");

/* ---------- 4c. Parent bridge: theme sync + ready signal (append before </body>) ---------- */
html = replaceOnce(html,
  `window.addEventListener("hashchange",route);`,
  `window.addEventListener("hashchange",route);

/* Scholar's Circle host bridge: live theme sync + boot signal. */
try{
  if(window.parent && window.parent !== window){
    window.addEventListener("message", e => {
      if(e.origin !== location.origin || !e.data) return;
      if(e.data.type === "sc-theme"){
        const t = e.data.theme === "light" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", t);
        try{ localStorage.setItem("atlas-theme", t); }catch(err){}
      }
      if(e.data.type === "sc-navigate" && typeof e.data.hash === "string" && /^#\\/[\\w\\/-]*$/.test(e.data.hash))
        location.hash = e.data.hash;
    });
    parent.postMessage({type:"atlas:ready"}, location.origin);
  }
}catch(err){}`,
  "host bridge listener");

/* ---------- write ---------- */
const outHtml = path.join(outDir, "index.html");
fs.writeFileSync(outHtml, html);
console.log(report.join("\n"));
console.log(`\nindex.html: ${(origLen/1e6).toFixed(1)}MB -> ${(html.length/1e6).toFixed(1)}MB`);
console.log(`wrote ${outHtml} + model.b64`);
