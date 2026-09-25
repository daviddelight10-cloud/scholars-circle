import { callAI, extractJSON } from "../../lib/aiClient";
import { API_BASE } from "../../lib/constants";
import { isWrittenType, normalizeExamPayload } from "./examSchema";

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return authData.authToken
      ? { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" }
      : { "Content-Type": "application/json" };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

/** The saved exam variant nested under a source file, if any. */
export function findExamVariant(file) {
  return file?.variants?.exam || null;
}

/** Parse a resource's exam payload (mcqData holds the exam JSON). */
export function examFromResource(resource) {
  if (!resource || resource.contentType !== "exam") return null;
  let raw = resource.mcqData;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return normalizeExamPayload(raw);
}

/**
 * Persist a generated exam as a Resource (contentType "exam") via the existing
 * study-tool-save endpoint — auto-bookmarks into My Space and links back to
 * the source file via sourceResourceId/folderId.
 */
export async function saveExamResource(payload, sourceFile) {
  const res = await fetch(`${API_BASE}/api/resources/study-tool-save`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      title: payload.config?.name || `Exam — ${sourceFile?.title || "Material"}`,
      subject: sourceFile?.subject || "",
      contentType: "exam",
      mcqData: payload,
      description: payload.analysis?.summary || null,
      folderId: sourceFile?.folderId || null,
      sourceResourceId: sourceFile?.id || null,
      isPublic: false,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save exam");
  }
  return res.json();
}

function buildGradingPrompt(items) {
  const rubric = items
    .map((it, i) => {
      const scheme = Array.isArray(it.question.markingScheme) && it.question.markingScheme.length
        ? it.question.markingScheme.map((p, j) => `   ${j + 1}. ${p}`).join("\n")
        : `   (No explicit scheme — award marks for accurate, relevant content matching the model answer)`;
      return `Question ${i + 1} [id:${it.question.id}] (${it.question.marks} marks)\nQ: ${it.question.question}\nModel answer: ${it.question.modelAnswer}\nMarking scheme:\n${scheme}\nStudent answer: ${it.answer || "(blank)"}`;
    })
    .join("\n\n---\n\n");

  return `You are a fair university examiner. Grade each student's written answer against the marking scheme and model answer.

${rubric}

Return ONLY a JSON array — one object per question, same order:
[
  {
    "id": "<question id>",
    "marksAwarded": <number 0..max>,
    "feedback": "<2-3 sentences: what was right, what was missing>",
    "coveredPoints": ["<scheme points the student hit>"],
    "missedPoints": ["<scheme points missing or wrong>"]
  }
]

Rules:
- Award partial credit — never all-or-nothing.
- Blank answers get 0 marks with a brief "no answer" feedback.
- Be strict but fair; marksAwarded must be an integer or .5 step, never above the question's max marks.`;
}

/**
 * AI-grade all written (shortanswer/essay) answers in one batched call per 8
 * questions. Returns { [questionId]: { marksAwarded, maxMarks, feedback,
 * coveredPoints, missedPoints } }. Throws on total failure so callers can
 * fall back to self-review.
 */
export async function gradeWrittenAnswers(questions, answers) {
  const items = questions
    .map((q, i) => ({ q, i, answer: answers[i] }))
    .filter((it) => isWrittenType(it.q.type));
  if (!items.length) return {};

  const grading = {};
  const BATCH = 8;
  let anyOk = false;
  for (let s = 0; s < items.length; s += BATCH) {
    const slice = items.slice(s, s + BATCH).map((it) => ({ question: it.q, answer: it.answer }));
    try {
      const raw = await callAI(buildGradingPrompt(slice));
      const parsed = extractJSON(raw, "array");
      for (const g of Array.isArray(parsed) ? parsed : []) {
        const src = slice.find((it) => it.question.id === g.id) || slice[Number(g.id) - 1];
        if (!src) continue;
        const max = src.question.marks || 5;
        grading[src.question.id] = {
          marksAwarded: Math.min(max, Math.max(0, Number(g.marksAwarded) || 0)),
          maxMarks: max,
          feedback: String(g.feedback || ""),
          coveredPoints: Array.isArray(g.coveredPoints) ? g.coveredPoints.map(String) : [],
          missedPoints: Array.isArray(g.missedPoints) ? g.missedPoints.map(String) : [],
        };
      }
      anyOk = true;
    } catch (err) {
      console.warn("[exam] AI grading batch failed:", err?.message);
    }
  }
  if (!anyOk) throw new Error("AI grading unavailable — review the model answers below and grade yourself honestly.");
  return grading;
}

/**
 * Submit a finished exam attempt. Reuses quiz-attempts (mode "exam") with
 * skipFsrs so exam questions never pollute the spaced-review pool.
 */
export async function submitExamAttempt(examResourceId, { score, total, details }) {
  const res = await fetch(`${API_BASE}/api/resources/quiz-attempts`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      resourceId: examResourceId,
      score,
      total,
      details,
      mode: "exam",
      skipFsrs: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit exam");
  }
  return res.json();
}
