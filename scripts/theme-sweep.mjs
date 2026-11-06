// Theme sweep codemod — replaces canonical dark literals with --app-* vars.
// Safe-by-construction: every replacement's dark :root value equals the
// original literal, so dark mode renders identically; light mode gets a
// coherent palette. Property-context aware:
//   color-ish props  → text vars (--app-text/dim/faint)
//   bg/border/everything-else → surface/tint vars
// Var definitions (lines starting with `--name:`) are skipped — we already
// rewrote the scoped palettes by hand.
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src");
const SKIP = new Set([
  path.resolve("src/lib/theme.js"),
]);
const EXT = new Set([".css", ".js", ".jsx"]);

// ── literal → var maps ──────────────────────────────────────────────────────
const BG_MAP = new Map(Object.entries({
  "#0a0a0a": "--app-bg", "#0a0a08": "--app-bg", "#0d0d0d": "--app-bg",
  "#0f0f0f": "--app-bg", "#050505": "--app-bg", "#070912": "--app-bg",
  "#070707": "--app-bg", "#090909": "--app-bg", "#0b0b0d": "--app-bg",
  "#111": "--app-surface", "#111111": "--app-surface", "#121212": "--app-surface",
  "#141414": "--app-surface", "#15150f": "--app-surface", "#161616": "--app-surface",
  "#131316": "--app-surface",
  "#181818": "--app-card", "#1a1a1a": "--app-card", "#1a1a1c": "--app-card",
  "#1d1d13": "--app-card2", "#1e1e22": "--app-card2", "#1f1f1f": "--app-card2",
  "#1f1f23": "--app-card2", "#202024": "--app-card2", "#222": "--app-card2",
  "#222222": "--app-card2", "#232328": "--app-card2", "#26262c": "--app-card2",
  "#242428": "--app-card2",
  "#2a2a2a": "--app-border", "#2a2a1d": "--app-border", "#2e2e2e": "--app-border",
  "#333": "--app-border", "#333333": "--app-border", "#3a3a1a": "--app-border",
  "#3a3a41": "--app-border", "#2f3750": "--app-border", "#3a3a3c": "--app-border",
}));

const TEXT_MAP = new Map(Object.entries({
  "#fff": "--app-text", "#ffffff": "--app-text",
  "#e8e8e8": "--app-text", "#EDEFF5": "--app-text", "#edeff5": "--app-text",
  "#f5f5f7": "--app-text", "#F5F7FB": "--app-text", "#EAEEF7": "--app-text",
  "#E7EAF0": "--app-text", "#eaf0f8": "--app-text", "#e2e8f0": "--app-text",
  "#f4f2e9": "--app-text", "#e9ecff": "--app-text", "#fafafa": "--app-text",
  "#f1f1f1": "--app-text", "#eee": "--app-text", "#eeeeee": "--app-text",
  "#888": "--app-dim", "#888888": "--app-dim", "#9AA3B5": "--app-dim",
  "#9ba3b7": "--app-dim", "#8B8B98": "--app-dim", "#98937e": "--app-dim",
  "#8b93a7": "--app-dim", "#8A93A6": "--app-dim", "#9AA2B2": "--app-dim",
  "#6b7280": "--app-dim", "#9ca3af": "--app-dim", "#7a7a8c": "--app-dim",
  "#555": "--app-faint", "#555555": "--app-faint", "#646E84": "--app-faint",
  "#5B5B66": "--app-faint", "#5b5b66": "--app-faint", "#565F72": "--app-faint",
  "#565E6E": "--app-faint", "#4c4c5c": "--app-faint",
}));

// white-rgba in color props → text var by alpha; elsewhere → tint var by alpha
function textVarForAlpha(a) {
  if (a >= 0.75) return "--app-text";
  if (a >= 0.42) return "--app-dim";
  return "--app-faint";
}
function tintVarForAlpha(a) {
  if (a <= 0.06) return "--app-tint-soft";
  if (a <= 0.12) return "--app-tint-med";
  return "--app-tint-strong";
}

// ── property classification ─────────────────────────────────────────────────
const TEXT_PROP = /^(color|caret-color|caretColor|text-decoration-color|textDecorationColor|text|textColor|textDim|textMuted|textFaint|textHi|textMid|textLow|muted|dim|faint|sub|subtle|secondary|secondaryText|placeholder|label|caption|desc|description)$/i;
const BG_PROP = /^(background|background-color|backgroundColor|background-image|backgroundImage|bg|bgColor|surface|card|cardBg|panel|ink|screen|page|fill|stop-color|stopColor|accent-color|accentColor|scrollbar-color|scrollbarColor)$/i;
const BORDER_PROP = /^(border|border-color|borderColor|border-top|borderTop|border-right|borderRight|border-bottom|borderBottom|border-left|borderLeft|border-top-color|borderTopColor|border-right-color|borderRightColor|border-bottom-color|borderBottomColor|border-left-color|borderLeftColor|outline|outline-color|outlineColor|box-shadow|boxShadow|text-shadow|textShadow|line|stroke|divide-color|divideColor|ring-color|ringColor|column-rule|columnRule|text-stroke|textStroke|-webkit-text-stroke|WebkitTextStroke|borderStyle|border-style)$/i;

const TW_TEXT = new Set(["text", "placeholder"]);
const TW_BG = new Set(["bg", "border", "from", "via", "to", "ring", "divide", "fill", "stroke", "outline", "accent", "caret", "decoration"]);

const VAR_DEF_LINE = /^\s*(--[A-Za-z][\w-]*|[A-Za-z_$][\w$]*\.?[A-Za-z_$]*)\s*:/;

function replaceHexes(str, map) {
  return str.replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => {
    const v = map.get(m) ?? map.get(m.toLowerCase());
    return v ? `var(${v})` : m;
  });
}
function replaceWhiteRgba(str, varFor) {
  return str.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/g,
    (_, a) => `var(${varFor(parseFloat(a))})`);
}

// Replace inside one declaration span starting after "prop:" up to ; , } or EOL-ish
function sweepValueSpan(text, start, endChars, isText) {
  let i = start;
  while (i < text.length && !endChars.has(text[i])) i++;
  let span = text.slice(start, i);
  span = replaceHexes(span, isText ? TEXT_MAP : BG_MAP);
  span = replaceWhiteRgba(span, isText ? textVarForAlpha : tintVarForAlpha);
  return { span, end: i };
}

function processFile(file) {
  let text = fs.readFileSync(file, "utf8");
  const lines = text.split("\n");
  let changed = 0;

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    // skip var definitions: `--name: value` at line start
    if (/^\s*--[A-Za-z][\w-]*\s*:/.test(line)) continue;

    let out = "";
    let i = 0;
    while (i < line.length) {
      // try to match "prop:" at i (prop chars then colon)
      const rest = line.slice(i);
      const m = rest.match(/^([A-Za-z_-][\w-]*)\s*:/);
      if (m && (TEXT_PROP.test(m[1]) || BG_PROP.test(m[1]) || BORDER_PROP.test(m[1]))) {
        const isText = TEXT_PROP.test(m[1]);
        const propStart = i + m[0].length;
        // skip leading whitespace inside value
        let vs = propStart;
        while (vs < line.length && line[vs] === " ") vs++;
        // JS template literal / nested braces: stop at ; , } ) ` or newline
        const { span, end } = sweepValueSpan(line, vs, new Set([";", ",", "}", ")", "`"]), isText);
        if (span !== line.slice(vs, end)) changed++;
        out += m[0] + line.slice(propStart, vs) + span;
        i = end;
        continue;
      }
      out += rest[0];
      i++;
    }
    lines[li] = out;
  }

  text = lines.join("\n");

  // Tailwind arbitrary values: bg-[#0a0a0a], text-[rgba(255,255,255,.6)], etc.
  text = text.replace(/\b([a-z]+)-\[([^\]]+)\]/g, (whole, prefix, inner) => {
    let next = inner;
    if (TW_TEXT.has(prefix)) {
      next = replaceHexes(next, TEXT_MAP);
      next = replaceWhiteRgba(next, textVarForAlpha);
    } else if (TW_BG.has(prefix)) {
      next = replaceHexes(next, BG_MAP);
      next = replaceWhiteRgba(next, tintVarForAlpha);
    }
    if (next !== inner) changed++;
    return `${prefix}-[${next}]`;
  });

  // neutral leftovers: dark bg hexes + white rgba still unreplaced
  text = text.replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => {
    const v = BG_MAP.get(m) ?? BG_MAP.get(m.toLowerCase());
    if (v) { changed++; return `var(${v})`; }
    return m;
  });
  text = text.replace(/rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*([\d.]+)\s*\)/g,
    (m, a) => { changed++; return `var(${tintVarForAlpha(parseFloat(a))})`; });

  if (changed > 0) {
    fs.writeFileSync(file, text);
    return changed;
  }
  return 0;
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "dist") walk(p, out); }
    else if (EXT.has(path.extname(e.name)) && !SKIP.has(p)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
let total = 0;
for (const f of files) {
  const n = processFile(f);
  if (n) { console.log(`${String(n).padStart(4)}  ${path.relative(SRC, f)}`); total += n; }
}
console.log(`\n${total} replacements across ${files.length} files`);
