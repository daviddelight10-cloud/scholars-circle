// Gemini lesson generation — one-page PDF + extracted text, structured output.
// Kept behind a small interface so the pilot can A/B a cheaper provider
// (e.g. GLM via OpenRouter) on the same pages without touching routes.
import { LESSON_SCHEMA, validateLesson, applyGrounding } from "./lessonSchema.js";
import { SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt.js";

const MODEL = process.env.PAGE_TUTOR_MODEL || "gemini-3.8-flash";

async function callGemini({ pdfBase64, pageText, page, resourceTitle, docContext = "", totalPages = 0 }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "no-key", retriable: false };
  const parts = [
    ...(pdfBase64 ? [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }] : []),
    {
      text: `Document: "${resourceTitle || "lecture notes"}". This is page ${page}${totalPages ? ` of ${totalPages}` : ""}` +
        (pdfBase64 ? " extracted as its own file.\n" : " (image extraction failed — work from the text below).\n") +
        (docContext
          ? `Overview of the whole document (one preview line per page — use it to place this page in the material):\n"""\n${docContext}\n"""\n\n`
          : "") +
        (pageText
          ? `Machine-extracted text of this page${pdfBase64 ? " (may be imperfect; the PDF above is ground truth)" : ""}:\n"""\n${pageText}\n"""\n\n`
          : `This page has no extractable text — it is scanned or image-only. Read the PDF image.\n\n`) +
        `Produce the lesson JSON now.`,
    },
  ];
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: LESSON_SCHEMA,
      temperature: 0.3,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingLevel: "low" }, // cheapest supported level — "minimal" is rejected on 3.8
    },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000), // a hung call must not hold the request open
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.error?.message || `gemini ${res.status}`,
        retriable: res.status === 429 || res.status >= 500,
      };
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const usage = data?.usageMetadata || {};
    return {
      ok: true,
      text,
      tokensIn: usage.promptTokenCount || 0,
      tokensOut: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0),
      model: MODEL,
    };
  } catch (err) {
    return { ok: false, error: err.message, retriable: true };
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRY_DELAYS = [1500, 4000]; // before attempts 2 and 3 — demand spikes clear in seconds

// Gemini only: 3 attempts, backoff between them. One schema retry is folded
// in (a bad-JSON response burns an attempt like a retriable failure).
export async function generateWithGemini({ pdfBase64, pageText, page, resourceTitle, docContext = "", totalPages = 0 }) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAYS[attempt - 1] || 4000);
    const r = await callGemini({ pdfBase64, pageText, page, resourceTitle, docContext, totalPages });
    if (!r.ok) { lastErr = r.error; if (!r.retriable) break; continue; }
    let parsed;
    try { parsed = JSON.parse(r.text); } catch { parsed = null; }
    const v = validateLesson(parsed);
    if (v.ok) {
      const g = applyGrounding(v.lesson, pageText || "");
      return { ok: true, lesson: v.lesson, grounded: g, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model };
    }
    lastErr = `schema: ${v.problems.join(", ")}`;
    if (attempt === 2) return { ok: false, lessonFailedSchema: true, rawText: r.text, error: lastErr, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model };
  }
  return { ok: false, error: lastErr || "generation failed" };
}

// Orchestrator: Gemini → GLM (OpenRouter) → fail. GLM is skipped entirely when
// PAGE_TUTOR_FALLBACK=off or there's no OpenRouter key, and during premium
// regenerations (allowFallback=false) which exist to restore gemini quality.
// glmOnly: the client's second-phase request — Gemini just failed on the first
// pass, so go straight to GLM instead of burning another 3 attempts.
// needImage: returned instead of running text-only GLM when the client sent no
// page image — the reader answers it with a glmRetry request carrying one.
export async function generateLesson({ pdfBase64, pageText, page, resourceTitle, pageImage, allowFallback = true, glmOnly = false, docContext = "", totalPages = 0 }) {
  if (glmOnly) {
    const { generateWithGLM } = await import("./glm.js");
    const g = await generateWithGLM({ pageImage, pageText, page, resourceTitle, docContext, totalPages });
    if (g.ok) return { ...g, source: pageImage ? "glm" : "glm_text" };
    if (g.lessonFailedSchema) return { ...g, source: "glm" };
    return { ok: false, error: `glm: ${g.error}` };
  }
  const r = await generateWithGemini({ pdfBase64, pageText, page, resourceTitle, docContext, totalPages });
  if (r.ok) return { ...r, source: "gemini" };
  if (r.lessonFailedSchema) return { ...r, source: "gemini" };
  if (!allowFallback || process.env.PAGE_TUTOR_FALLBACK === "off" || !process.env.OPENROUTER_API_KEY) {
    return { ok: false, error: r.error || "generation failed" };
  }
  // GLM can't read the server-side PDF — it needs the client's page image.
  // Ask for one rather than silently degrading to text-only; the reader only
  // sends the ~600KB render when generation actually reaches this point.
  if (!pageImage) return { ok: false, needImage: true, error: r.error };
  const { generateWithGLM } = await import("./glm.js");
  const g = await generateWithGLM({ pageImage, pageText, page, resourceTitle, docContext, totalPages });
  if (g.ok) {
    console.log(`[pageTutor] gemini failed (${r.error}) — glm fallback succeeded`);
    return { ...g, source: "glm" };
  }
  if (g.lessonFailedSchema) return { ...g, source: "glm" };
  return { ok: false, error: `gemini: ${r.error} | glm: ${g.error}` };
}

export { PROMPT_VERSION };
