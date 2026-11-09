export const PRESET_SUBJECTS = [
  "Anatomy",
  "Physiology",
  "Biochemistry",
  "Pathology",
  "Pharmacology",
  "Microbiology",
  "Internal Medicine",
  "Surgery",
  "Obstetrics & Gynaecology",
  "Paediatrics",
  "Custom",
];

export const contentTypeConfig = {
  pdf: { label: "PDF", icon: "📄", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  image: { label: "Image", icon: "🖼", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  docx: { label: "DOCX", icon: "📝", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  pptx: { label: "PPT", icon: "📊", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  txt: { label: "Text", icon: "📃", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  note: { label: "Note", icon: "📝", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  mcq: { label: "Practice Questions", icon: "✎", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  flashcard_deck: { label: "Flashcards", icon: "🎴", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  tutorial_question: { label: "Tutorial Q", icon: "❓", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  exam: { label: "Exam", icon: "🎓", bg: "var(--app-card)", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
};

export function formatRelativeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWk = Math.floor(diffDay / 7);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWk < 4) return `${diffWk}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
