// Helper functions for Research Hub feature
import { contentTypeConfig } from "../features/research-hub/constants";

// Copy share token to clipboard
export async function copyShareToken(token) {
  const url = `${window.location.origin}/resources/${token}`;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch (err) {
    console.error("Failed to copy:", err);
    return false;
  }
}

// Get color class for subject badge
export function getSubjectBadgeColor(subject) {
  const colors = {
    PHY: { bg: "#1a1a1a", text: "#FFD700", border: "rgba(255,215,0,0.25)" },
    BIO: { bg: "#0f2a1a", text: "#66bb6a", border: "#2a6a3a" },
    ANA: { bg: "#2a0a0a", text: "#ef9a9a", border: "#4a1010" },
    CHM: { bg: "#1a1000", text: "#ffb74d", border: "#3a2800" },
    Cardiology: { bg: "#2a0a0a", text: "#ef9a9a", border: "#4a1010" },
    GST: { bg: "#1a1a1a", text: "#FFD700", border: "rgba(255,215,0,0.25)" },
    HEE: { bg: "#0f2a1a", text: "#66bb6a", border: "#2a6a3a" },
  };
  return colors[subject] || { bg: "#1a1a1a", text: "#888", border: "#2a2a2a" };
}

// Get icon for content type
export function getContentTypeIcon(type) {
  return contentTypeConfig[type]?.icon || "📄";
}

// Get icon class for content type
export function getContentTypeIconClass(type) {
  const classes = {
    pdf: "icon-pdf",
    note: "icon-note",
    mcq: "icon-mcq",
    tutorial_question: "icon-tq",
    image: "icon-image",
    docx: "icon-docx",
    pptx: "icon-pptx",
    txt: "icon-txt",
    flashcard_deck: "icon-flashcard",
    exam: "icon-exam",
  };
  return classes[type] || "icon-pdf";
}

// Document ring percentage from my-mcq-progress data.
// Learning progress (FSRS-staged learnedPct) fills up to 90% of the ring;
// the last 10% comes from true mastery (mastered/total) so a good quiz
// score alone can never show a full ring.
export function mcqRingPct(prog) {
  if (!prog) return 0;
  const total = prog.total || prog.bestTotal || 0;
  const learned = prog.learnedPct
    ?? (total > 0 ? Math.min(100, Math.round(((prog.mastered || 0) / total) * 100)) : 0);
  const masteredPct = total > 0 ? ((prog.mastered || 0) / total) * 100 : 0;
  return Math.min(100, Math.round(learned * 0.9 + masteredPct * 0.1));
}

// Format view count
export function formatViewCount(count) {
  if (count == null) return "0";
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

// Stable storage key for a document URL (shared with PdfReader)
export function docKeyFromUrl(url) {
  let hash = 0;
  for (let i = 0; i < (url || "").length; i++) {
    hash = ((hash << 5) - hash) + (url || "").charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

// Local PDF reading progress: { pct, lastPage, numPages, done } | null// Reads the same localStorage keys PdfReader writes.
export function getPdfReadingProgress(fileUrl) {
  if (!fileUrl) return null;
  try {
    const docKey = docKeyFromUrl(fileUrl);
    const meta = JSON.parse(localStorage.getItem(`sc_pdf_meta_${docKey}`) || "null");
    const lastPage = JSON.parse(localStorage.getItem(`sc_pdf_lastpage_${docKey}`) || "null");
    const numPages = meta?.numPages || 0;
    if (!numPages || !lastPage || lastPage <= 1) return null;
    const pct = Math.min(100, Math.round((lastPage / numPages) * 100));
    if (pct <= 0) return null;
    return { pct, lastPage, numPages, done: pct >= 98 };
  } catch {
    return null;
  }
}

// Pastel tile tints (Gizmo-style) — stable per-folder color picked by name hash.
const TILE_TINTS = ["#FFB300", "#FF5C8A", "#4DA3FF", "#6EE787", "#B18CFF"];

export function tileTintStyle(seed) {
  let h = 0;
  for (let i = 0; i < (seed || "").length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  const c = TILE_TINTS[Math.abs(h) % TILE_TINTS.length];
  return {
    background: `linear-gradient(160deg, ${c}3D, ${c}0F)`,
    borderColor: `${c}4D`,
    color: c,
  };
}
