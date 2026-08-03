import { API_BASE } from "./constants";

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

/**
 * Generate a curriculum skeleton from an outline document or a course name.
 * Delegates AI generation to the server (server-side API keys, authoritative writes).
 *
 * @param {object} params
 * @param {string} params.courseName - The course name or code
 * @param {string} [params.outlineText] - Extracted text from an uploaded outline (optional)
 * @param {string} [params.courseCode] - Course code override (optional)
 * @param {function} [params.onProgress] - Progress callback
 * @returns {Promise<{topics: Array, source: string, courseCode: string}>}
 */
export async function generateSkeleton({ courseName, outlineText, courseCode, onProgress }) {
  const hasOutline = outlineText && outlineText.trim().length > 50;
  const source = hasOutline ? "outline" : "ai_inferred";
  const effectiveCourseCode = (courseCode || courseName || "").trim();

  onProgress?.(hasOutline ? "Extracting topics from outline…" : "Generating topic skeleton with AI…");

  // Delegate to server — it calls AI, parses, saves, and returns saved topics
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(effectiveCourseCode)}/topics`, {
    method: "POST",
    body: JSON.stringify({
      outlineText: hasOutline ? outlineText : undefined,
      courseName: courseName || effectiveCourseCode,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to generate skeleton on server");
  }

  const savedTopics = await res.json();

  onProgress?.(`Saved ${savedTopics.length} topics ✓`);

  return { topics: savedTopics, source, courseCode: effectiveCourseCode };
}

/**
 * Fetch existing curriculum topics for a course.
 * @param {string} courseCode
 * @returns {Promise<Array>}
 */
export async function fetchSkeleton(courseCode) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/topics`);
  if (!res.ok) throw new Error("Failed to fetch skeleton");
  return res.json();
}

/**
 * Fetch document-topic matches for a course (current user).
 * @param {string} courseCode
 * @returns {Promise<Array>}
 */
export async function fetchTopicMatches(courseCode) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/matches`);
  if (!res.ok) throw new Error("Failed to fetch matches");
  return res.json();
}

/**
 * Fetch aggregate FSRS progress per topic for a course.
 * @param {string} courseCode
 * @returns {Promise<object>} Map of topicId -> progress stats
 */
export async function fetchTopicProgress(courseCode) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/topic-progress`);
  if (!res.ok) throw new Error("Failed to fetch topic progress");
  return res.json();
}

/**
 * Corroborate an AI-inferred topic.
 * @param {string} topicId
 * @returns {Promise<object>}
 */
export async function corroborateTopic(topicId) {
  const res = await authFetch(`${API_BASE}/api/curriculum/topics/${topicId}/corroborate`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to corroborate topic");
  return res.json();
}

/**
 * Dispute an AI-inferred topic.
 * @param {string} topicId
 * @returns {Promise<object>}
 */
export async function disputeTopic(topicId) {
  const res = await authFetch(`${API_BASE}/api/curriculum/topics/${topicId}/dispute`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to dispute topic");
  return res.json();
}
