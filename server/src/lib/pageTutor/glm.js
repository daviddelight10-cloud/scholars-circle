// GLM fallback via OpenRouter — used when Gemini is unavailable (demand
// spikes, retirement, no key). GLM can't take a PDF part, so the client sends
// a rendered page image which we forward as an image_url. Text-only when the
// client sent no image. JSON comes back through response_format json_object
// plus the same schema spelled out in the prompt — strict json_schema is
// rejected by several GLM provider endpoints, so we don't rely on it.
import { LESSON_SCHEMA, validateLesson, applyGrounding } from "./lessonSchema.js";
import { SYSTEM_PROMPT } from "./prompt.js";

const GLM_MODEL = process.env.PAGE_TUTOR_GLM_MODEL || "z-ai/glm-5.3-flash";

const SCHEMA_HINT = `Respond with a single JSON object (no markdown, no commentary) with exactly this shape:
${JSON.stringify(LESSON_SCHEMA)}`;

function extractJson(text) {
  const clean = String(text || "").replace(/```(?:json)?/gi, "").trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.slice(start, end + 1)); } catch {}
  }
  return null;
}

async function callGLM({ pageImage, pageText, page, resourceTitle }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return { ok: false, error: "no-openrouter-key", retriable: false };
  const content = [
    ...(pageImage ? [{ type: "image_url", image_url: { url: pageImage } }] : []),
    {
      type: "text",
      text: `Document: "${resourceTitle || "lecture notes"}". This is page ${page}` +
        (pageImage ? " shown in the image above.\n" : " (no page image available — work from the text below).\n") +
        (pageText
          ? `Machine-extracted text of this page${pageImage ? " (may be imperfect; the image is ground truth)" : ""}:\n"""\n${pageText}\n"""\n\n`
          : `\n`) +
        `Produce the lesson JSON now.\n${SCHEMA_HINT}`,
    },
  ];
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://scholars-circle.vercel.app",
        "X-Title": "Scholar's Circle Page Tutor",
      },
      body: JSON.stringify({
        model: GLM_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content },
        ],
        temperature: 0.3,
        max_tokens: 8192,
        response_format: { type: "json_object" },
        reasoning: { effort: "low" },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.error?.message || `openrouter ${res.status}`,
        retriable: res.status === 429 || res.status === 402 || res.status >= 500,
      };
    }
    const text = data?.choices?.[0]?.message?.content || "";
    const usage = data?.usage || {};
    return {
      ok: true,
      text,
      tokensIn: usage.prompt_tokens || 0,
      tokensOut: usage.completion_tokens || 0,
      model: data?.model || GLM_MODEL,
    };
  } catch (err) {
    return { ok: false, error: err.message, retriable: true };
  }
}

// Same contract as generateWithGemini: { ok, lesson?, grounded?, lessonFailedSchema?, rawText?, error?, ... }
export async function generateWithGLM({ pageImage, pageText, page, resourceTitle }) {
  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await callGLM({ pageImage, pageText, page, resourceTitle });
    if (!r.ok) { lastErr = r.error; if (!r.retriable) break; continue; }
    const parsed = extractJson(r.text);
    const v = validateLesson(parsed);
    if (v.ok || attempt === 1) {
      if (!v.ok) return { ok: false, lessonFailedSchema: true, rawText: r.text, error: `schema: ${v.problems.join(", ")}`, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model };
      const g = applyGrounding(v.lesson, pageText || "");
      return { ok: true, lesson: v.lesson, grounded: g, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: r.model };
    }
    lastErr = `schema: ${v.problems.join(", ")}`;
  }
  return { ok: false, error: lastErr || "glm generation failed" };
}
