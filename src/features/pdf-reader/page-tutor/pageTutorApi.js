import { API_BASE } from "../../../lib/constants";

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

// Cache-hit OR generate — one endpoint. extras: { pageImage, pageText, regenerate }.
// pageImage is a rendered JPEG data URL used only by the GLM fallback path;
// pageText carries client OCR text for scanned pages.
export async function explainPage(resourceId, page, extras = {}) {
  const res = await fetch(`${API_BASE}/api/page-tutor/lesson`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ resourceId, page, ...extras }),
  });
  return readJson(res);
}

// { pages: [n], items: flattened recall entries } — dots + chapter review.
export async function getLessonPages(resourceId) {
  const res = await fetch(`${API_BASE}/api/page-tutor/lessons?resourceId=${encodeURIComponent(resourceId)}`, { headers: getAuthHeaders() });
  return readJson(res);
}

// { audioStatus, sections: [{sectionId, status, durationMs, url}] }
export async function getAudio(lessonId) {
  const res = await fetch(`${API_BASE}/api/page-tutor/audio/${lessonId}`, { headers: getAuthHeaders() });
  const data = await readJson(res);
  // Disk-fallback paths come back as "/uploads/..." — same origin as the API.
  for (const s of data.sections || []) {
    if (s.url?.startsWith("/")) s.url = `${API_BASE}${s.url}`;
  }
  return data;
}

export async function retryAudio(lessonId) {
  const res = await fetch(`${API_BASE}/api/page-tutor/lesson/${lessonId}/retry-audio`, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  return readJson(res);
}

export async function saveFlashcards(lessonId, resourceId) {
  const res = await fetch(`${API_BASE}/api/page-tutor/lesson/${lessonId}/flashcards`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ resourceId }),
  });
  return readJson(res);
}

export async function reportLesson(lessonId, reason, note) {
  const res = await fetch(`${API_BASE}/api/page-tutor/lesson/${lessonId}/report`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ reason, note }),
  });
  return readJson(res);
}

export function logEvent(lessonId, kind) {
  return fetch(`${API_BASE}/api/page-tutor/lesson/${lessonId}/event`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ kind }),
  }).then(readJson).catch(() => null);
}
