import React from "react";

const D = {
  text: "#c5cae9",
  muted: "#9e9e9e",
  accent: "#7986cb",
  codeBg: "#0d0f1f",
  codeBorder: "#1e2140",
  heading: "#e8eaf6",
};

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
    return `<div style="text-align:center;margin:8px 0;font-size:15px;color:#e8eaf6;font-family:'Cambria Math','STIX',serif">${escapeHtml(result)}</div>`;
  }
  return `<span style="font-family:'Cambria Math','STIX',serif;color:#e8eaf6">${escapeHtml(result)}</span>`;
}

function renderInline(text) {
  let html = escapeHtml(text);
  // Display math $$...$$
  html = html.replace(/\$\$([^$]+)\$\$/g, (_, m) => renderMath("$$" + m + "$$", true));
  // Inline math $...$
  html = html.replace(/\$([^$\n]+)\$/g, (_, m) => renderMath("$" + m + "$", false));
  // Bold
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, `<code style="background:${D.codeBg};border:0.5px solid ${D.codeBorder};border-radius:4px;padding:1px 5px;font-size:12px;font-family:monospace">$1</code>`);
  return html;
}

export default function MarkdownText({ children, style }) {
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
          background: D.codeBg, border: `0.5px solid ${D.codeBorder}`,
          borderRadius: 8, padding: "10px 12px", overflowX: "auto",
          fontSize: 12, fontFamily: "monospace", color: "#b0bec5",
          margin: "8px 0", whiteSpace: "pre",
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
          elements.push(<ul key={elements.length} style={{ margin: "6px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 3 }}>{li}</li>)}</ul>);
          listItems = [];
        }
        i++;
        continue;
      }

      // Headings
      if (trimmed.startsWith("### ")) {
        if (listItems.length > 0) { elements.push(<ul key={elements.length} style={{ margin: "6px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j}>{li}</li>)}</ul>); listItems = []; }
        elements.push(<div key={elements.length} style={{ fontSize: 14, fontWeight: 700, color: D.heading, margin: "10px 0 4px", ...style }} dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(4)) }} />);
        i++;
        continue;
      }
      if (trimmed.startsWith("## ")) {
        if (listItems.length > 0) { elements.push(<ul key={elements.length} style={{ margin: "6px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j}>{li}</li>)}</ul>); listItems = []; }
        elements.push(<div key={elements.length} style={{ fontSize: 15, fontWeight: 700, color: D.heading, margin: "12px 0 6px", ...style }} dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(3)) }} />);
        i++;
        continue;
      }
      if (trimmed.startsWith("# ")) {
        if (listItems.length > 0) { elements.push(<ul key={elements.length} style={{ margin: "6px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j}>{li}</li>)}</ul>); listItems = []; }
        elements.push(<div key={elements.length} style={{ fontSize: 16, fontWeight: 800, color: D.heading, margin: "14px 0 6px", ...style }} dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(2)) }} />);
        i++;
        continue;
      }

      // List items
      if (/^[-*•]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
        const content = trimmed.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
        listItems.push(<span key={listItems.length} dangerouslySetInnerHTML={{ __html: renderInline(content) }} />);
        i++;
        continue;
      }

      // Blockquote
      if (trimmed.startsWith("> ")) {
        if (listItems.length > 0) { elements.push(<ul key={elements.length} style={{ margin: "6px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j}>{li}</li>)}</ul>); listItems = []; }
        elements.push(<div key={elements.length} style={{ borderLeft: "3px solid #3949ab", paddingLeft: 10, margin: "6px 0", color: D.muted, ...style }} dangerouslySetInnerHTML={{ __html: renderInline(trimmed.slice(2)) }} />);
        i++;
        continue;
      }

      // Regular paragraph
      if (listItems.length > 0) {
        elements.push(<ul key={elements.length} style={{ margin: "6px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 3 }}>{li}</li>)}</ul>);
        listItems = [];
      }
      elements.push(<div key={elements.length} style={{ margin: "4px 0", ...style }} dangerouslySetInnerHTML={{ __html: renderInline(line) }} />);
      i++;
    }

    if (listItems.length > 0) {
      elements.push(<ul key={elements.length} style={{ margin: "6px 0", paddingLeft: 20, ...style }}>{listItems.map((li, j) => <li key={j} style={{ marginBottom: 3 }}>{li}</li>)}</ul>);
    }
  }

  return <div style={{ fontSize: 13.5, lineHeight: 1.7, color: D.text, fontFamily: "Manrope,sans-serif", wordBreak: "break-word", overflowWrap: "anywhere" }}>{elements}</div>;
}
