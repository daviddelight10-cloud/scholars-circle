import { jsPDF } from "jspdf";

const COLORS = {
  heading: [184, 134, 11],     // gold
  subheading: [60, 63, 96],    // muted blue
  body: [30, 30, 35],          // near-black
  bullet: [184, 134, 11],      // gold
  accent: [120, 100, 40],      // darker gold
  divider: [200, 180, 120],    // light gold
};

const PAGE = {
  width: 595.28,   // A4 in points
  height: 841.89,
  marginX: 56,
  marginTop: 70,
  marginBottom: 60,
};

export function generateSummaryPdf(title, subject, summaryText) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const contentWidth = PAGE.width - PAGE.marginX * 2;
  let y = PAGE.marginTop;

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
    const subjText = subject;
    const subjWidth = doc.getTextWidth(subjText) + 20;
    doc.setFillColor(26, 26, 26);
    doc.roundedRect(PAGE.marginX, y - 2, subjWidth, 20, 4, 4, "F");
    doc.setTextColor(184, 134, 11);
    doc.text(subjText, PAGE.marginX + 10, y + 12);
    y += 30;
  }

  // ── Divider ──
  doc.setDrawColor(...COLORS.divider);
  doc.setLineWidth(0.5);
  doc.line(PAGE.marginX, y, PAGE.width - PAGE.marginX, y);
  y += 20;

  // ── Parse and render summary text ──
  const lines = summaryText.split("\n");
  let isFirstHeading = true;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // Skip empty lines — add small gap
    if (!line.trim()) {
      y += 8;
      continue;
    }

    // Page break check
    if (y > PAGE.height - PAGE.marginBottom) {
      addPageFooter(doc);
      doc.addPage();
      y = PAGE.marginTop;
    }

    // ## Heading
    if (line.startsWith("## ")) {
      if (!isFirstHeading) y += 6;
      isFirstHeading = false;
      y += 4;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...COLORS.heading);
      const text = line.replace(/^##\s+/, "");
      const wrapped = doc.splitTextToSize(text, contentWidth);
      // Gold underline accent
      for (let i = 0; i < wrapped.length; i++) {
        if (y > PAGE.height - PAGE.marginBottom) { addPageFooter(doc); doc.addPage(); y = PAGE.marginTop; }
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
      continue;
    }

    // ### Subheading
    if (line.startsWith("### ")) {
      y += 2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.subheading);
      const text = line.replace(/^###\s+/, "");
      const wrapped = doc.splitTextToSize(text, contentWidth);
      for (const w of wrapped) {
        if (y > PAGE.height - PAGE.marginBottom) { addPageFooter(doc); doc.addPage(); y = PAGE.marginTop; }
        doc.text(w, PAGE.marginX, y);
        y += 15;
      }
      y += 2;
      continue;
    }

    // Bullet point (- or •), optionally indented for nesting
    const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)/);
    if (bulletMatch) {
      const leadingSpaces = bulletMatch[1];
      const text = bulletMatch[3];
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.body);
      const baseIndent = 20;
      const extraIndent = Math.min(leadingSpaces.length * 6, 24);
      const totalIndent = baseIndent + extraIndent;
      // Gold bullet dot
      doc.setFillColor(...COLORS.bullet);
      doc.circle(PAGE.marginX + 4 + extraIndent, y - 3, 2, "F");
      const wrapped = doc.splitTextToSize(text, contentWidth - totalIndent);
      for (let i = 0; i < wrapped.length; i++) {
        if (y > PAGE.height - PAGE.marginBottom) { addPageFooter(doc); doc.addPage(); y = PAGE.marginTop; }
        doc.text(wrapped[i], PAGE.marginX + totalIndent, y);
        y += 14;
      }
      y += 2;
      continue;
    }

    // Numbered list (1. 2. etc)
    if (/^\d+\.\s/.test(line)) {
      const match = line.match(/^(\d+)\.\s+(.*)/);
      const num = match[1];
      const text = match[2];
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...COLORS.bullet);
      doc.text(`${num}.`, PAGE.marginX, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.body);
      const wrapped = doc.splitTextToSize(text, contentWidth - 20);
      for (let i = 0; i < wrapped.length; i++) {
        if (y > PAGE.height - PAGE.marginBottom) { addPageFooter(doc); doc.addPage(); y = PAGE.marginTop; }
        doc.text(wrapped[i], PAGE.marginX + 20, y);
        y += 14;
      }
      y += 2;
      continue;
    }

    // Bold line (**text**)
    if (/^\*\*[^*]+\*\*$/.test(line.trim())) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...COLORS.accent);
      const text = line.replace(/\*\*/g, "").trim();
      const wrapped = doc.splitTextToSize(text, contentWidth);
      for (const w of wrapped) {
        if (y > PAGE.height - PAGE.marginBottom) { addPageFooter(doc); doc.addPage(); y = PAGE.marginTop; }
        doc.text(w, PAGE.marginX, y);
        y += 15;
      }
      y += 2;
      continue;
    }

    // Regular paragraph — handle inline bold
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.body);
    y = renderInlineBold(doc, line, PAGE.marginX, y, contentWidth);
    y += 4;
  }

  // ── Footer on last page ──
  addPageFooter(doc);

  return doc.output("arraybuffer");
}

function renderInlineBold(doc, text, x, y, maxWidth) {
  const segments = parseInlineBold(text);
  let currentX = x;
  let lineHeight = 14;

  for (const seg of segments) {
    if (!seg.text) continue;
    doc.setFont("helvetica", seg.bold ? "bold" : "normal");
    if (seg.bold) doc.setTextColor(...COLORS.accent);
    else doc.setTextColor(...COLORS.body);

    const words = seg.text.split(" ");
    for (const word of words) {
      const wordWidth = doc.getTextWidth(word + " ");
      if (currentX + wordWidth > x + maxWidth) {
        y += lineHeight;
        currentX = x;
        if (y > PAGE.height - PAGE.marginBottom) {
          addPageFooter(doc);
          doc.addPage();
          y = PAGE.marginTop;
          currentX = x;
        }
      }
      doc.text(word + " ", currentX, y);
      currentX += wordWidth;
    }
  }

  return y;
}

function parseInlineBold(text) {
  const segments = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), bold: false });
    }
    segments.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), bold: false });
  }
  return segments.length > 0 ? segments : [{ text, bold: false }];
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
