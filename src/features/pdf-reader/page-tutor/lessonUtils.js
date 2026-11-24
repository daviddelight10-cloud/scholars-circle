// Pure helpers for the Page Tutor UI — kept framework-free for tests.
export const fmtTime = (ms) => {
  const total = Math.max(0, Math.round((ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const SPEEDS = [0.75, 1, 1.25, 1.5, 2];

// Ordered, playable audio sections. speech: false | "failed" | "always" —
// "failed" lets sections whose hosted audio failed play via device voice;
// "always" prefers files but marks everything speakable (future data-saver).
// mode: "file" | "speech" | null.
export const playableSections = (lesson, audioSections, { speech = false } = {}) => {
  const byId = new Map((audioSections || []).map((a) => [a.sectionId, a]));
  return (lesson?.sections || []).map((s, i) => {
    const a = byId.get(s.id) || null;
    const fileReady = a?.status === "ready" && !!a?.url;
    const speakable = !!(String(s.narration || "").trim() || String(s.explanation || "").trim());
    const failed = a?.status === "failed";
    const speechOk = !!speech && speakable && (speech === "always" ? !fileReady : failed);
    return {
      index: i,
      sectionId: s.id,
      heading: s.heading,
      audio: a,
      playable: fileReady || speechOk,
      mode: fileReady ? "file" : speechOk ? "speech" : null,
    };
  });
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
