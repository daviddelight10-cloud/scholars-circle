// Helper functions for Research Hub feature

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
    PHY: { bg: "#0f1440", text: "#7986cb", border: "#2a3080" },
    BIO: { bg: "#0f2a1a", text: "#66bb6a", border: "#1a4a2a" },
    ANA: { bg: "#2a0a0a", text: "#ef9a9a", border: "#4a1010" },
    CHM: { bg: "#1a1000", text: "#ffb74d", border: "#3a2800" },
    Cardiology: { bg: "#2a0a0a", text: "#ef9a9a", border: "#4a1010" },
    GST: { bg: "#0f1440", text: "#7986cb", border: "#2a3080" },
    HEE: { bg: "#0f2a1a", text: "#66bb6a", border: "#1a4a2a" },
  };
  return colors[subject] || { bg: "#0f1128", text: "#7b82b8", border: "#252860" };
}

// Get icon for content type
export function getContentTypeIcon(type) {
  const icons = {
    pdf: "📄",
    note: "📖",
    mcq: "📝",
    tutorial_question: "❓",
    image: "🖼️",
    docx: "📃",
    pptx: "📊",
    txt: "📝",
  };
  return icons[type] || "📄";
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
  };
  return classes[type] || "icon-pdf";
}

// Format view count
export function formatViewCount(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}
