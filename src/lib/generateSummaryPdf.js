import { jsPDF } from "jspdf";

const COLORS = {
  heading: [184, 134, 11],     // gold
  subheading: [60, 63, 96],    // muted blue
  body: [30, 30, 35],          // near-black
  bullet: [184, 134, 11],      // gold
  accent: [120, 100, 40],      // darker gold
  divider: [200, 180, 120],    // light gold
  quoteBg: [245, 241, 230],    // faint parchment
  codeBg: [34, 34, 40],        // dark panel
  codeText: [225, 225, 230],
  tableLine: [210, 200, 170],
  tableHeadBg: [32, 28, 18],
  tableHeadText: [235, 200, 90],
};

const PAGE = {
  width: 595.28,   // A4 in points
  height: 841.89,
  marginX: 56,
  marginTop: 70,
  marginBottom: 60,
};

const LINE_H = 14;

// ─────────────────────────────────────────────────────────────
// Markdown normalization — fix the common ways AI output drifts
// from the expected format before tokenizing.
// ─────────────────────────────────────────────────────────────
export function normalizeSummaryMarkdown(text) {
  return String(text || "")
    .split("\n")
    .map((line) =>
      line
        // "* item" / "• item" bullets → "- item"
        .replace(/^(\s*)[*•]\s+/, "$1- ")
        // "3.**text**" / "3.text" → "3. text" (numbered list needs space)
        .replace(/^(\s*)(\d+)\.(?!\s|$)/, "$1$2. ")
    )
    .join("\n");
}

// ─────────────────────────────────────────────────────────────
// markdownToBlocks — tokenizer producing typed blocks the
// renderer can lay out deterministically.
// ─────────────────────────────────────────────────────────────
export function markdownToBlocks(text) {
  const lines = normalizeSummaryMarkdown(text).split("\n");
  const blocks = [];
  let i = 0;

  const BLOCK_START = /^(#{1,4}\s|>|\||```|([-*_])\2{2,}$|[-*•]\s|\d+[.)]\s)/;

  while (i < lines.length) {
    const raw = lines[i];
    const trimmed = raw.trim();

    if (!trimmed) { i++; continue; }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) { buf.push(lines[i]); i++; }
      if (i < lines.length) i++; // consume closing fence
      blocks.push({ type: "code", lines: buf });
      continue;
    }

    // Horizontal rule
    if (/^([-*_])\1{2,}$/.test(trimmed)) { blocks.push({ type: "hr" }); i++; continue; }

    // Headings # – ####
    const h = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (h) { blocks.push({ type: `h${h[1].length}`, text: h[2].trim() }); i++; continue; }

    // Blockquote — merge consecutive ">" lines
    if (trimmed.startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "quote", text: buf.join(" ") });
      continue;
    }

    // Table — consecutive "|"-led lines
    if (trimmed.startsWith("|")) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(
          lines[i].trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
        );
        i++;
      }
      const isSep = (r) => r.length > 0 && r.every((c) => /^:?-+:?$/.test(c));
      const header = rows.length > 1 && isSep(rows[1]) ? rows[0] : null;
      const body = rows.slice(header ? 2 : 0).filter((r) => !isSep(r));
      if (header || body.length) blocks.push({ type: "table", header, rows: body });
      continue;
    }

    // List items — "- item" or "1. item" / "1) item", indent-aware
    const indent = Math.floor((raw.length - raw.trimStart().length) / 2);
    const bullet = trimmed.match(/^-\s+(.*)/);
    if (bullet) { blocks.push({ type: "li", ordered: false, indent, text: bullet[1] }); i++; continue; }
    const numbered = trimmed.match(/^(\d+)[.)]\s+(.*)/);
    if (numbered) { blocks.push({ type: "li", ordered: true, num: numbered[1], indent, text: numbered[2] }); i++; continue; }

    // Paragraph — merge consecutive plain lines so wrapping is continuous
    const buf = [trimmed];
    i++;
    while (i < lines.length) {
      const t = lines[i].trim();
      if (!t || BLOCK_START.test(t)) break;
      buf.push(t);
      i++;
    }
    blocks.push({ type: "p", text: buf.join(" ") });
  }

  return blocks;
}

// ─────────────────────────────────────────────────────────────
// parseInline — split text into formatting runs:
// **bold**, *italic*, `code`
// ─────────────────────────────────────────────────────────────
export function parseInline(text) {
  const runs = [];
  const re = /(\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith("**")) runs.push({ text: tok.slice(2, -2), bold: true });
    else if (tok.startsWith("`")) runs.push({ text: tok.slice(1, -1), code: true });
    else runs.push({ text: tok.slice(1, -1), italic: true });
    last = m.index + tok.length;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

function stripInline(text) {
  return parseInline(text).map((r) => r.text).join("");
}

// ─────────────────────────────────────────────────────────────
// PDF generation
// ─────────────────────────────────────────────────────────────
export function generateSummaryPdf(title, subject, summaryText) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const contentWidth = PAGE.width - PAGE.marginX * 2;
  let y;

  const newPage = () => {
    addPageFooter(doc);
    doc.addPage();
    return PAGE.marginTop;
  };
  const ensure = (need = LINE_H) => {
    if (y + need > PAGE.height - PAGE.marginBottom) y = newPage();
  };

  // ── Header band ──
  doc.setFillColor(20, 20, 28);
  doc.rect(0, 0, PAGE.width, 50, "F");
  doc.setFillColor(184, 134, 11);
  doc.rect(0, 50, PAGE.width, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(184, 134, 11);
  doc.text("Scholars Circle", PAGE.marginX, 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 170);
  doc.text("AI-Generated Study Summary", PAGE.width - PAGE.marginX, 32, { align: "right" });

  y = 80;

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...COLORS.heading);
  const titleLines = doc.splitTextToSize(title, contentWidth);
  doc.text(titleLines, PAGE.marginX, y);
  y += titleLines.length * 26 + 4;

  // ── Subject badge ──
  if (subject) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const subjWidth = doc.getTextWidth(subject) + 20;
    doc.setFillColor(26, 26, 26);
    doc.roundedRect(PAGE.marginX, y - 2, subjWidth, 20, 4, 4, "F");
    doc.setTextColor(184, 134, 11);
    doc.text(subject, PAGE.marginX + 10, y + 12);
    y += 30;
  }

  // ── Divider ──
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.5);
  doc.line(PAGE.marginX, y, PAGE.width - PAGE.marginX, y);
  y += 20;

  // ── Rich-text render engine ──
  // Draws formatting runs with word-wrap; returns the NEXT baseline.
  function renderRichText(runs, x, startY, maxWidth, { fontSize = 10, boldColor = COLORS.accent, textColor = COLORS.body } = {}) {
    let curY = startY;
    let curX = x;
    doc.setFontSize(fontSize);

    for (const run of runs) {
      if (!run.text) continue;
      const fontName = run.code ? "courier" : "helvetica";
      const fontStyle = run.code ? "normal" : (run.bold && run.italic) ? "bolditalic" : run.bold ? "bold" : run.italic ? "italic" : "normal";
      doc.setFont(fontName, fontStyle);
      doc.setTextColor(...(run.bold ? boldColor : run.code ? COLORS.subheading : textColor));

      for (const word of run.text.split(" ")) {
        if (word === "") continue;
        const wordWidth = doc.getTextWidth(word + " ");
        if (curX + wordWidth > x + maxWidth) {
          curY += LINE_H;
          curX = x;
          ensure();
        }
        doc.text(word + " ", curX, curY);
        curX += wordWidth;
      }
    }
    doc.setFont("helvetica", "normal");
    return curY + LINE_H; // next baseline
  }

  // ── Render blocks ──
  const blocks = markdownToBlocks(summaryText);
  let isFirstHeading = true;

  for (const block of blocks) {
    switch (block.type) {
      case "h1":
      case "h2": {
        if (!isFirstHeading) y += 8;
        isFirstHeading = false;
        ensure(30);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.setTextColor(...COLORS.heading);
        const wrapped = doc.splitTextToSize(stripInline(block.text), contentWidth);
        for (let i = 0; i < wrapped.length; i++) {
          ensure(LINE_H + 6);
          doc.text(wrapped[i], PAGE.marginX, y);
          if (i === wrapped.length - 1) {
            y += 4;
            doc.setDrawColor(...COLORS.divider);
            doc.setLineWidth(0.8);
            doc.line(PAGE.marginX, y, PAGE.marginX + 40, y);
          }
          y += 18;
        }
        y += 4;
        break;
      }

      case "h3":
      case "h4": {
        y += 4;
        ensure(LINE_H);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(...COLORS.subheading);
        const wrapped = doc.splitTextToSize(stripInline(block.text), contentWidth);
        for (const w of wrapped) {
          ensure(LINE_H);
          doc.text(w, PAGE.marginX, y);
          y += 15;
        }
        y += 2;
        break;
      }

      case "li": {
        const extraIndent = Math.min(block.indent * 12, 36);
        const textIndent = 20 + extraIndent;
        ensure(LINE_H);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(...COLORS.bullet);
        if (block.ordered) {
          doc.text(`${block.num}.`, PAGE.marginX + extraIndent, y);
        } else {
          doc.setFillColor(...COLORS.bullet);
          doc.circle(PAGE.marginX + 4 + extraIndent, y - 3, 2, "F");
        }
        y = renderRichText(parseInline(block.text), PAGE.marginX + textIndent, y, contentWidth - textIndent);
        y += 2;
        break;
      }

      case "quote": {
        // Callout box — ⚠️ red flags and 💎 pearls get distinct tints
        const isWarn = /^⚠️|^⚠/.test(block.text);
        const isPearl = /^💎/.test(block.text);
        const boxBg = isWarn ? [253, 236, 236] : isPearl ? [248, 240, 205] : COLORS.quoteBg;
        const barCol = isWarn ? [198, 60, 60] : COLORS.heading;
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        const innerW = contentWidth - 24;
        const measured = doc.splitTextToSize(stripInline(block.text), innerW);
        const boxH = measured.length * LINE_H + 14;
        ensure(boxH);
        doc.setFillColor(...boxBg);
        doc.rect(PAGE.marginX, y - 10, contentWidth, boxH, "F");
        doc.setFillColor(...barCol);
        doc.rect(PAGE.marginX, y - 10, 2.5, boxH, "F");
        y = renderRichText(parseInline(block.text), PAGE.marginX + 12, y, innerW, { fontSize: 10 });
        y += 10;
        break;
      }

      case "code": {
        doc.setFont("courier", "normal");
        doc.setFontSize(9);
        const codeLines = [];
        for (const cl of block.lines) codeLines.push(...doc.splitTextToSize(cl || " ", contentWidth - 20));
        ensure(Math.min(codeLines.length * 12 + 14, 80));
        const boxH = codeLines.length * 12 + 14;
        doc.setFillColor(...COLORS.codeBg);
        doc.rect(PAGE.marginX, y - 9, contentWidth, boxH, "F");
        doc.setTextColor(...COLORS.codeText);
        for (const cl of codeLines) { doc.text(cl, PAGE.marginX + 10, y); y += 12; }
        y += 10;
        break;
      }

      case "hr": {
        y += 6;
        ensure(LINE_H);
        doc.setDrawColor(...COLORS.divider);
        doc.setLineWidth(0.5);
        doc.line(PAGE.marginX, y, PAGE.width - PAGE.marginX, y);
        y += 14;
        break;
      }

      case "table": {
        const cols = Math.max(block.header?.length || 0, ...block.rows.map((r) => r.length));
        if (!cols) break;
        const colW = contentWidth / cols;
        const cellPad = 6;

        const rowHeight = (cells, bold) => {
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setFontSize(9);
          let lines = 1;
          for (let c = 0; c < cols; c++) {
            const wrapped = doc.splitTextToSize(stripInline(cells[c] || ""), colW - cellPad * 2);
            lines = Math.max(lines, wrapped.length);
          }
          return lines * 12 + 8;
        };
        const drawRow = (cells, bold) => {
          const rh = rowHeight(cells, bold);
          ensure(rh);
          if (bold) {
            doc.setFillColor(...COLORS.tableHeadBg);
            doc.rect(PAGE.marginX, y - 9, contentWidth, rh, "F");
          }
          doc.setFont("helvetica", bold ? "bold" : "normal");
          doc.setFontSize(9);
          doc.setTextColor(...(bold ? COLORS.tableHeadText : COLORS.body));
          for (let c = 0; c < cols; c++) {
            const wrapped = doc.splitTextToSize(stripInline(cells[c] || ""), colW - cellPad * 2);
            doc.text(wrapped, PAGE.marginX + c * colW + cellPad, y + 4);
          }
          doc.setDrawColor(...COLORS.tableLine);
          doc.setLineWidth(0.5);
          doc.line(PAGE.marginX, y + rh - 4, PAGE.marginX + contentWidth, y + rh - 4);
          y += rh;
        };

        y += 4;
        if (block.header) drawRow(block.header, true);
        for (const r of block.rows) drawRow(r, false);
        y += 8;
        break;
      }

      case "p":
      default: {
        ensure(LINE_H);
        y = renderRichText(parseInline(block.text), PAGE.marginX, y, contentWidth);
        y += 4;
        break;
      }
    }
  }

  addPageFooter(doc);
  return doc.output("arraybuffer");
}

function addPageFooter(doc) {
  const pageCount = doc.getNumberOfPages();
  const currentPage = doc.getCurrentPageInfo().pageNumber;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(140, 140, 150);
  doc.text("Scholars Circle", PAGE.marginX, PAGE.height - 30);
  doc.text(`${currentPage} / ${pageCount}`, PAGE.width - PAGE.marginX, PAGE.height - 30, { align: "right" });
}
