// Gemini lesson generation — one-page PDF + extracted text, structured output.
// Kept behind a small interface so the pilot can A/B a cheaper provider
// (e.g. GLM via OpenRouter) on the same pages without touching routes.
import { LESSON_SCHEMA, validateLesson, applyGrounding } from "./lessonSchema.js";
import { SYSTEM_PROMPT, PROMPT_VERSION } from "./prompt.js";

const MODEL = process.env.PAGE_TUTOR_MODEL || "gemini-2.5-flash";

async function callGemini({ pdfBase64, pageText, page, resourceTitle }) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, error: "no-key", retriable: false };
  const parts = [
    ...(pdfBase64 ? [{ inlineData: { mimeType: "application/pdf", data: pdfBase64 } }] : []),
    {
      text: `Document: "${resourceTitle || "lecture notes"}". This is page ${page}` +
        (pdfBase64 ? " extracted as its own file.\n" : " (image extraction failed — work from the text below).\n") +
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
      thinkingConfig: { thinkingBudget: 0 }, // no paid thinking tokens on cached lessons
    },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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

// Returns { ok, lesson?, tokensIn, tokensOut, model, error? } — one retry on
// schema failure, then the caller falls back to text_only.
export async function generateLesson({ pdfBase64, pageText, page, resourceTitle }) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await callGemini({ pdfBase64, pageText, page, resourceTitle });
    if (!r.ok) { lastErr = r.error; if (!r.retriable) break; continue; }
    let parsed;
    try { parsed = JSON.parse(r.text); } catch { parsed = null; }
    const v = validateLesson(parsed);
    if (v.ok || attempt === 1) {
      if (!v.ok) return { ok: false, lessonFailedSchema: true, rawText: r.text, error: `schema: ${v.problems.join(", ")}`, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model };
      const g = applyGrounding(v.lesson, pageText || "");
      return { ok: true, lesson: v.lesson, grounded: g, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model };
    }
    lastErr = `schema: ${v.problems.join(", ")}`;
  }
  return { ok: false, error: lastErr || "generation failed" };
}

export { PROMPT_VERSION };
