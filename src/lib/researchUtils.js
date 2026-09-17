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
  };
  return classes[type] || "icon-pdf";
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

// Local PDF reading progress: { pct, lastPage, numPages, done } | null
// Reads the same localStorage keys PdfReader writes.
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
