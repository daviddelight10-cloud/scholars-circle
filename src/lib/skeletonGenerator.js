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
export async function generateSkeleton({ courseName, outlineText, courseCode, onProgress, merge }) {
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
      merge: !!merge,
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
 * Manually add a topic to a course roadmap.
 * @param {string} courseCode
 * @param {string} title
 * @param {number} [displayOrder]
 * @returns {Promise<Array>} The full updated topic list for the course
 */
export async function createTopic(courseCode, title, displayOrder, extra = {}) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/topics`, {
    method: "POST",
    body: JSON.stringify({ topics: [{ title, displayOrder, ...extra }], source: "manual" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to add topic");
  }
  return res.json();
}

/**
 * Bulk reorder topics for a course (per-user).
 * @param {string} courseCode
 * @param {string[]} topicIds - Ordered array of topic IDs
 * @returns {Promise<Array>} Updated topics in new order
 */
export async function reorderTopics(courseCode, topicIds) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/reorder`, {
    method: "PATCH",
    body: JSON.stringify({ topicIds }),
  });
  if (!res.ok) throw new Error("Failed to reorder topics");
  return res.json();
}

/** Update a topic (title, description, subtopics, prerequisites, doneSubs, manuallyDone). */
export async function updateTopic(topicId, patch) {
  const res = await authFetch(`${API_BASE}/api/curriculum/topics/${encodeURIComponent(topicId)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update topic");
  }
  return res.json();
}

export async function deleteTopic(topicId) {
  const res = await authFetch(`${API_BASE}/api/curriculum/topics/${encodeURIComponent(topicId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete topic");
  return res.json();
}

/** Manually place a document under a topic (matchSource "manual", confidence 1). */
export async function assignDocument(resourceId, topicId) {
  const res = await authFetch(`${API_BASE}/api/curriculum/matches`, {
    method: "POST",
    body: JSON.stringify({ resourceId, topicId, matchSource: "manual" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to place document");
  }
  return res.json();
}

/** Remove a document↔topic match by match id. */
export async function unassignDocument(matchId) {
  const res = await authFetch(`${API_BASE}/api/curriculum/matches/${encodeURIComponent(matchId)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to remove document");
  return res.json();
}

/** Export the roadmap as portable JSON (prereqs resolved to titles). */
export async function exportRoadmap(courseCode) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/export`);
  if (!res.ok) throw new Error("Failed to export roadmap");
  return res.json();
}

/** Import a roadmap JSON payload { topics: [...] } — merges into the course. */
export async function importRoadmap(courseCode, topics) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/topics`, {
    method: "POST",
    body: JSON.stringify({ topics, source: "import" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to import roadmap");
  }
  return res.json();
}

export async function fetchCoursePrefs(courseCode) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/prefs`);
  if (!res.ok) throw new Error("Failed to fetch course prefs");
  return res.json();
}

export async function saveCoursePrefs(courseCode, examDate) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/prefs`, {
    method: "PATCH",
    body: JSON.stringify({ examDate }),
  });
  if (!res.ok) throw new Error("Failed to save course prefs");
  return res.json();
}


