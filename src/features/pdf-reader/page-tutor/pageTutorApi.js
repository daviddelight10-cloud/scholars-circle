import { API_BASE } from "../../../lib/constants";
import { fetchWithAuth } from "../../../lib/authToken.js";

const EXPLAIN_TIMEOUT_MS = 90_000;

async function readJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

// Cache-hit OR generate — one endpoint. extras: { pageImage, pageText,
// regenerate, glmRetry }. pageImage is a rendered JPEG data URL used only by
// the GLM fallback path — the server answers { needImage: true } when it
// wants one, so it's only sent on the glmRetry follow-up request.
// Bounded at 90s — a hung request must surface as an error, not spin forever.
export async function explainPage(resourceId, page, extras = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), EXPLAIN_TIMEOUT_MS);
  try {
    const res = await fetchWithAuth(`${API_BASE}/api/page-tutor/lesson`, {
      method: "POST",
      body: JSON.stringify({ resourceId, page, ...extras }),
      signal: ctrl.signal,
    });
    return await readJson(res);
  } catch (err) {
    if (err?.name === "AbortError") {
      const e = new Error("The tutor is taking too long — try again in a moment");
      e.code = "timeout";
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// { pages: [n], items: flattened recall entries } — dots + chapter review.
export async function getLessonPages(resourceId) {
  const res = await fetchWithAuth(`${API_BASE}/api/page-tutor/lessons?resourceId=${encodeURIComponent(resourceId)}`);
  return readJson(res);
}

// { audioStatus, sections: [{sectionId, status, durationMs, url}] }
export async function getAudio(lessonId) {
  const res = await fetchWithAuth(`${API_BASE}/api/page-tutor/audio/${lessonId}`);
  const data = await readJson(res);
  // Disk-fallback paths come back as "/uploads/..." — same origin as the API.
  for (const s of data.sections || []) {
    if (s.url?.startsWith("/")) s.url = `${API_BASE}${s.url}`;
  }
  return data;
}

export async function retryAudio(lessonId) {
  const res = await fetchWithAuth(`${API_BASE}/api/page-tutor/lesson/${lessonId}/retry-audio`, {
    method: "POST",
  });
  return readJson(res);
}

export async function saveFlashcards(lessonId, resourceId) {
  const res = await fetchWithAuth(`${API_BASE}/api/page-tutor/lesson/${lessonId}/flashcards`, {
    method: "POST",
    body: JSON.stringify({ resourceId }),
  });
  return readJson(res);
}

export async function reportLesson(lessonId, reason, note) {
  const res = await fetchWithAuth(`${API_BASE}/api/page-tutor/lesson/${lessonId}/report`, {
    method: "POST",
    body: JSON.stringify({ reason, note }),
  });
  return readJson(res);
}

export function logEvent(lessonId, kind) {
  return fetchWithAuth(`${API_BASE}/api/page-tutor/lesson/${lessonId}/event`, {
    method: "POST",
    body: JSON.stringify({ kind }),
  }).then(readJson).catch(() => null);
}
