import React from "react";

const PALETTES = {
  dark: {
    text: "#FFD700",
    muted: "#9e9e9e",
    accent: "#7986cb",
    codeBg: "#0d0f1f",
    codeBorder: "#1e2140",
    heading: "#e8eaf6",
    mathColor: "#e8eaf6",
    blockquoteBorder: "#B8860B",
    blockquoteBg: "rgba(184,134,11,0.06)",
    blockquoteText: "#c8b560",
    codeText: "#b0bec5",
    boldColor: "#FFD700",
    italicColor: "#9fa8da",
    listBullet: "#B8860B",
    headingBorder: "#1e2140",
  },
  light: {
    text: "#2D2823",
    muted: "#6B665C",
    accent: "#C23B3B",
    codeBg: "#f5f3ee",
    codeBorder: "#d4d0c5",
    heading: "#1a1a2e",
    mathColor: "#2D2823",
    blockquoteBorder: "#C23B3B",
    blockquoteBg: "rgba(194,59,59,0.05)",
    blockquoteText: "#8a3030",
    codeText: "#3F3A33",
    boldColor: "#1a1a2e",
    italicColor: "#555",
    listBullet: "#C23B3B",
    headingBorder: "#d4d0c5",
  },
};

const D = PALETTES.dark;

function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderMath(match, display) {
  let expr = match;
  if (expr.startsWith("$$")) expr = expr.slice(2, -2);
  else if (expr.startsWith("$")) expr = expr.slice(1, -1);
  expr = expr.trim();

  const replacements = [
    [/\\frac\{([^}]+)\}\{([^}]+)\}/g, "($1)/($2)"],
    [/\\sqrt\{([^}]+)\}/g, "√($1)"],
    [/\\sqrt/g, "√"],
    [/\\times/g, "×"],
    [/\\div/g, "÷"],
    [/\\pm/g, "±"],
    [/\\mp/g, "∓"],
    [/\\cdot/g, "·"],
    [/\\leq/g, "≤"],
    [/\\geq/g, "≥"],
    [/\\neq/g, "≠"],
    [/\\approx/g, "≈"],
    [/\\equiv/g, "≡"],
    [/\\rightarrow/g, "→"],
    [/\\leftarrow/g, "←"],
    [/\\Rightarrow/g, "⇒"],
    [/\\Leftarrow/g, "⇐"],
    [/\\leftrightarrow/g, "↔"],
    [/\\infty/g, "∞"],
    [/\\sum/g, "Σ"],
    [/\\prod/g, "Π"],
    [/\\int/g, "∫"],
    [/\\partial/g, "∂"],
    [/\\nabla/g, "∇"],
    [/\\Delta/g, "Δ"],
    [/\\delta/g, "δ"],
    [/\\alpha/g, "α"],
    [/\\beta/g, "β"],
    [/\\gamma/g, "γ"],
    [/\\theta/g, "θ"],
    [/\\lambda/g, "λ"],
    [/\\mu/g, "μ"],
    [/\\pi/g, "π"],
    [/\\rho/g, "ρ"],
    [/\\sigma/g, "σ"],
    [/\\tau/g, "τ"],
    [/\\phi/g, "φ"],
    [/\\omega/g, "ω"],
    [/\\Omega/g, "Ω"],
    [/\\degree/g, "°"],
    [/\\circ/g, "°"],
    [/\\cup/g, "∪"],
    [/\\cap/g, "∩"],
    [/\\subset/g, "⊂"],
    [/\\supset/g, "⊃"],
    [/\\in/g, "∈"],
    [/\\notin/g, "∉"],
    [/\\forall/g, "∀"],
    [/\\exists/g, "∃"],
    [/\\propto/g, "∝"],
    [/\\perp/g, "⊥"],
    [/\\parallel/g, "∥"],
    [/\\angle/g, "∠"],
    [/\\dot\{([^}]+)\}/g, "$1̇"],
    [/\\vec\{([^}]+)\}/g, "$1⃗"],
    [/\\overline\{([^}]+)\}/g, "$1̄"],
    [/\\hat\{([^}]+)\}/g, "$1̂"],
    [/\\text\{([^}]+)\}/g, "$1"],
    [/\\mathrm\{([^}]+)\}/g, "$1"],
    [/\\left\(/g, "("],
    [/\\right\)/g, ")"],
    [/\\left\[/g, "["],
    [/\\right\]/g, "]"],
    [/\\,/g, " "],
    [/\\!/g, " "],
    [/\\;/g, " "],
    [/\\quad/g, "  "],
    [/\\qquad/g, "    "],
    [/\^\{([^}]+)\}/g, "^($1)"],
    [/_\{([^}]+)\}/g, "_($1)"],
    [/\^([0-9a-zA-Z])/g, "^$1"],
    [/_([0-9a-zA-Z])/g, "_$1"],
  ];

  let result = expr;
  for (const [pattern, replacement] of replacements) {
    result = result.replace(pattern, replacement);
  }
  result = result.replace(/\\\\/g, "").replace(/\\/g, "");

  if (display) {
    return `<div style="text-align:center;margin:8px 0;font-size:15px;color:__MATH_COLOR__;font-family:'Cambria Math','STIX',serif">${escapeHtml(result)}</div>`;
  }
  return `<span style="font-family:'Cambria Math','STIX',serif;color:__MATH_COLOR__">${escapeHtml(result)}</span>`;
}

function renderInline(text) {
  let html = escapeHtml(text);
  // Display math $$...$$
  html = html.replace(/\$\$([^$]+)\$\$/g, (_, m) => renderMath("$$" + m + "$$", true));
  // Inline math $...$
  html = html.replace(/\$([^$\n]+)\$/g, (_, m) => renderMath("$" + m + "$", false));
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:__BOLD_COLOR__">$1</strong>');
  // Italic
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em style="color:__ITALIC_COLOR__">$1</em>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, `<code style="background:__CODE_BG__;border:0.5px solid __CODE_BORDER__;border-radius:4px;padding:1px 5px;font-size:12px;font-family:monospace">$1</code>`);
  return html;
}

function renderInlineWithTheme(text, P) {
  return renderInline(text)
    .replace(/__MATH_COLOR__/g, P.mathColor)
    .replace(/__CODE_BG__/g, P.codeBg)
    .replace(/__CODE_BORDER__/g, P.codeBorder)
    .replace(/__BOLD_COLOR__/g, P.boldColor)
    .replace(/__ITALIC_COLOR__/g, P.italicColor);
}

export default function MarkdownText({ children, style, theme = "dark" }) {
  const P = PALETTES[theme] || PALETTES.dark;
  if (!children || typeof children !== "string") {
    return <div style={style}>{children}</div>;
  }

  const segments = children.split(/(```[\s\S]*?```)/g);
  const elements = [];

  for (let seg of segments) {
    if (seg.startsWith("```")) {
      const lines = seg.replace(/^```\w*\n?/, "").replace(/```$/, "").split("\n");
      elements.push(
        <pre key={elements.length} style={{
          background: P.codeBg, border: `0.5px solid ${P.codeBorder}`,
          borderRadius: 10, padding: "12px 14px", overflowX: "auto",
          fontSize: 12.5, fontFamily: "'Cascadia Code','Fira Code','Consolas',monospace", color: P.codeText,
          margin: "10px 0", whiteSpace: "pre", lineHeight: 1.5,
        }}>{lines.join("\n")}</pre>
      );
      continue;
    }

    const lines = seg.split("\n");
    let listItems = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Empty line
      if (!trimmed) {
        if (listItems.length > 0) {
          elements.push(<ul key={elements.length} style={{ margin: "8px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 4, color: P.text }}>{li}</li>)}</ul>);
          listItems = [];
        }
        i++;
        continue;
      }

      // Headings
      if (trimmed.startsWith("### ")) {
        if (listItems.length > 0) { elements.push(<ul key={elements.length} style={{ margin: "8px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 4, color: P.text }}>{li}</li>)}</ul>); listItems = []; }
        elements.push(<div key={elements.length} style={{ fontSize: 14, fontWeight: 700, color: P.heading, margin: "12px 0 5px", paddingBottom: 3, borderBottom: `0.5px solid ${P.headingBorder}`, ...style }} dangerouslySetInnerHTML={{ __html: renderInlineWithTheme(trimmed.slice(4), P) }} />);
        i++;
        continue;
      }
      if (trimmed.startsWith("## ")) {
        if (listItems.length > 0) { elements.push(<ul key={elements.length} style={{ margin: "8px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 4, color: P.text }}>{li}</li>)}</ul>); listItems = []; }
        elements.push(<div key={elements.length} style={{ fontSize: 15.5, fontWeight: 700, color: P.heading, margin: "14px 0 6px", paddingBottom: 4, borderBottom: `0.5px solid ${P.headingBorder}`, ...style }} dangerouslySetInnerHTML={{ __html: renderInlineWithTheme(trimmed.slice(3), P) }} />);
        i++;
        continue;
      }
      if (trimmed.startsWith("# ")) {
        if (listItems.length > 0) { elements.push(<ul key={elements.length} style={{ margin: "8px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 4, color: P.text }}>{li}</li>)}</ul>); listItems = []; }
        elements.push(<div key={elements.length} style={{ fontSize: 17, fontWeight: 800, color: P.heading, margin: "16px 0 8px", paddingBottom: 5, borderBottom: `0.5px solid ${P.headingBorder}`, ...style }} dangerouslySetInnerHTML={{ __html: renderInlineWithTheme(trimmed.slice(2), P) }} />);
        i++;
        continue;
      }

      // List items
      if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const content = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
        listItems.push(<span key={listItems.length} dangerouslySetInnerHTML={{ __html: renderInlineWithTheme(content, P) }} />);
        i++;
        continue;
      }

      // Blockquote — render as callout box
      if (trimmed.startsWith("> ")) {
        if (listItems.length > 0) { elements.push(<ul key={elements.length} style={{ margin: "8px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 4, color: P.text }}>{li}</li>)}</ul>); listItems = []; }
        elements.push(<div key={elements.length} style={{ background: P.blockquoteBg, borderLeft: `3px solid ${P.blockquoteBorder}`, borderRadius: "0 8px 8px 0", padding: "8px 12px", margin: "8px 0", color: P.blockquoteText, ...style }} dangerouslySetInnerHTML={{ __html: renderInlineWithTheme(trimmed.slice(2), P) }} />);
        i++;
        continue;
      }

      // Regular paragraph
      if (listItems.length > 0) {
        elements.push(<ul key={elements.length} style={{ margin: "8px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 4, color: P.text }}>{li}</li>)}</ul>);
        listItems = [];
      }
      elements.push(<div key={elements.length} style={{ margin: "6px 0", ...style }} dangerouslySetInnerHTML={{ __html: renderInlineWithTheme(line, P) }} />);
      i++;
    }

    if (listItems.length > 0) {
      elements.push(<ul key={elements.length} style={{ margin: "8px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 4, color: P.text }}>{li}</li>)}</ul>);
    }
  }

  return <div style={{ fontSize: 13.5, lineHeight: 1.75, color: P.text, fontFamily: "Manrope,sans-serif", wordBreak: "break-word", overflowWrap: "anywhere" }}>{elements}</div>;
}
