// Page Tutor lesson schema — the model returns structured JSON against this
// fixed schema (same approach as the generative diagram system); the frontend
// renders it, never free-form markup.
export const LESSON_SCHEMA = {
  type: "object",
  properties: {
    page_title: { type: "string" },
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          heading: { type: "string" },
          explanation: { type: "string" },
          narration: { type: "string" },
          terms: {
            type: "array",
            maxItems: 8,
            items: {
              type: "object",
              properties: { term: { type: "string" }, meaning: { type: "string" } },
              required: ["term", "meaning"],
            },
          },
          anchor_quote: { type: "string" },  // verbatim snippet from the page — grounding check + "see on page"
          source: { type: "string", enum: ["on_page", "added_context"] },
          unclear: { type: "boolean" },
        },
        required: ["id", "heading", "explanation", "narration", "source"],
      },
    },
    key_points: { type: "array", maxItems: 6, items: { type: "string" } },
    clinical_note: { type: "string", nullable: true },
    recall: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: { question: { type: "string" }, answer: { type: "string" } },
        required: ["question", "answer"],
      },
    },
  },
  required: ["page_title", "sections", "key_points", "recall"],
};

// Validate + normalize a parsed lesson. Returns { ok, lesson, problems }.
export function validateLesson(raw) {
  const problems = [];
  if (!raw || typeof raw !== "object") return { ok: false, problems: ["not an object"] };
  const lesson = { ...raw };
  if (typeof lesson.page_title !== "string" || !lesson.page_title.trim()) lesson.page_title = "Page lesson";
  if (!Array.isArray(lesson.sections) || lesson.sections.length === 0) {
    problems.push("no sections");
    return { ok: false, lesson, problems };
  }
  lesson.sections = lesson.sections.slice(0, 6).map((s, i) => ({
    id: typeof s?.id === "string" && s.id ? s.id : `s${i + 1}`,
    heading: String(s?.heading || `Section ${i + 1}`).slice(0, 120),
    explanation: String(s?.explanation || "").slice(0, 4000),
    narration: String(s?.narration || s?.explanation || "").slice(0, 2000),
    terms: Array.isArray(s?.terms) ? s.terms.slice(0, 8).map((t) => ({
      term: String(t?.term || "").slice(0, 80),
      meaning: String(t?.meaning || "").slice(0, 200),
    })).filter((t) => t.term && t.meaning) : [],
    anchor_quote: typeof s?.anchor_quote === "string" ? s.anchor_quote.slice(0, 200) : "",
    source: s?.source === "added_context" ? "added_context" : "on_page",
    unclear: s?.unclear === true,
  }));
  if (lesson.sections.some((s) => !s.explanation.trim())) problems.push("empty explanation");
  lesson.key_points = (Array.isArray(lesson.key_points) ? lesson.key_points : [])
    .map((k) => String(k || "").trim()).filter(Boolean).slice(0, 6);
  lesson.clinical_note = typeof lesson.clinical_note === "string" && lesson.clinical_note.trim()
    ? lesson.clinical_note.trim().slice(0, 600) : null;
  lesson.recall = (Array.isArray(lesson.recall) ? lesson.recall : [])
    .map((r) => ({ question: String(r?.question || "").trim(), answer: String(r?.answer || "").trim() }))
    .filter((r) => r.question && r.answer).slice(0, 4);
  if (lesson.recall.length === 0) problems.push("no recall questions");
  return { ok: problems.length === 0, lesson, problems };
}

// Grounding check: an on_page section must quote text actually on the page.
// Mismatches are demoted to added_context rather than rejected.
export function applyGrounding(lesson, pageText) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const hay = norm(pageText);
  let grounded = 0, demoted = 0;
  for (const s of lesson.sections) {
    if (s.source !== "on_page") continue;
    const q = norm(s.anchor_quote);
    if (q.length >= 12 && hay.includes(q)) { grounded += 1; continue; }
    if (q.length < 12) continue; // no usable quote — leave as is
    s.source = "added_context";
    demoted += 1;
  }
  return { grounded, demoted };
}
