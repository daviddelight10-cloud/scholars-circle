// Pure helpers for the Page Tutor UI — kept framework-free for tests.
export const fmtTime = (ms) => {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// Ordered, playable audio sections (only those with an mp3 ready).
export const playableSections = (lesson, audioSections) => {
  const byId = new Map((audioSections || []).map((a) => [a.sectionId, a]));
  return (lesson?.sections || []).map((s, i) => ({
    index: i,
    sectionId: s.id,
    heading: s.heading,
    audio: byId.get(s.id) || null,
    playable: byId.get(s.id)?.status === "ready" && !!byId.get(s.id)?.url,
  }));
};

// Context string handed to the live Voice Tutor on "Ask a question" —
// the lesson the student just heard, so the tutor builds on it.
export function buildLessonContext(lesson, page, docTitle = "") {
  if (!lesson) return "";
  const parts = [
    `Document "${docTitle}", page ${page}. Lesson title: "${lesson.page_title || ""}".`,
    ...(lesson.key_points || []).slice(0, 5).map((k, i) => `Key point ${i + 1}: ${k}`),
    ...(lesson.sections || []).slice(0, 4).map((s) => `Section "${s.heading}": ${String(s.explanation || "").slice(0, 300)}`),
  ];
  return parts.join("\n").slice(0, 2800);
}

// Map a student's self-rating to the FSRS grade scale the deck endpoint uses
// (1 = again, 2 = hard, 3 = good, 4 = easy — same 4-button scale as review).
export const GRADES = [
  { id: "again", label: "Missed it", grade: 1 },
  { id: "hard", label: "Hard", grade: 2 },
  { id: "good", label: "Got it", grade: 3 },
  { id: "easy", label: "Easy", grade: 4 },
];
