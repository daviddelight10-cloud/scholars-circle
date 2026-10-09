import { HIGHLIGHT_COLORS } from "./constants.js";

// Build the Markdown study-notes export from reader annotations.
// Pure data-in/string-out so it can be tested without React.
export function buildNotesMarkdown({ title, textMarks, bookmarks, annotations }) {
  const lines = [];
  lines.push(`# Study Notes — ${title || "PDF Document"}`);
  lines.push(`_Exported ${new Date().toLocaleString()}_`);
  lines.push("");

  const penPages = new Set(Object.keys(annotations).map(Number).filter((pg) => (annotations[pg] || []).length > 0));
  const markPages = new Set(Object.keys(textMarks).map(Number).filter((pg) => (textMarks[pg] || []).length > 0));
  const bmPages = new Set(bookmarks.map((b) => b.page));
  const allPages = [...new Set([...bmPages, ...markPages, ...penPages])].sort((a, b) => a - b);

  if (allPages.length === 0) {
    lines.push("_No highlights, notes, or bookmarks yet. Select text on the page to create one._");
  }

  for (const pg of allPages) {
    lines.push(`## Page ${pg}`);
    const bm = bookmarks.find((b) => b.page === pg);
    if (bm) lines.push(`- 🔖 **Bookmark**${bm.name ? `: ${bm.name}` : ""}`);
    for (const m of textMarks[pg] || []) {
      const colorName = HIGHLIGHT_COLORS.find((c) => c.value === m.color)?.name || "highlight";
      lines.push(`- > ${m.text.replace(/\s+/g, " ").trim()}  _(${colorName})_`);
      if (m.note) lines.push(`  - 📝 **Note:** ${m.note}`);
    }
    const strokes = (annotations[pg] || []).length;
    if (strokes > 0) lines.push(`- ✏️ ${strokes} freehand ink stroke${strokes > 1 ? "s" : ""} on this page`);
    lines.push("");
  }
  return lines.join("\n");
}

export function downloadTextFile(filename, text, mime = "text/markdown") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
