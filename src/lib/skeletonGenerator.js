import { callAI, extractJSON } from "./aiClient";
import { API_BASE } from "./constants";

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

/**
 * Build an outline-extraction prompt for generating a curriculum skeleton
 * from an uploaded course outline / syllabus document.
 */
function buildOutlineExtractionPrompt(text, courseCode) {
  return `You are an expert curriculum designer. Extract the complete topic skeleton from this course outline/syllabus.

COURSE CODE: ${courseCode || "Unknown"}

OUTLINE TEXT:
"""
${text.slice(0, 12000)}
"""

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "courseCode": "${courseCode || ""}",
  "topics": [
    {
      "title": "Topic name (concise, 2-6 words)",
      "description": "1-sentence description of what this topic covers",
      "displayOrder": 1,
      "prerequisiteTitles": ["Title of prerequisite topic", ...]
    }
  ]
}

RULES:
1. Extract ALL topics/modules/units from the outline in their original order.
2. Set displayOrder starting at 1, incrementing sequentially.
3. For prerequisiteTitles, list titles of topics that must be understood BEFORE this topic. Use exact titles from the list. Leave empty array if none.
4. Keep topic titles short (2-6 words).
5. Descriptions should be 1 sentence, under 20 words.
6. Return ONLY the JSON object.`;
}

/**
 * Build a generic skeleton generation prompt for when only a course name is provided.
 */
function buildGenericSkeletonPrompt(courseName, courseCode) {
  return `You are an expert curriculum designer. Generate a comprehensive topic skeleton for the course: "${courseName}"${courseCode ? ` (code: ${courseCode})` : ""}.

Return ONLY a valid JSON object (no markdown, no code blocks):
{
  "courseCode": "${courseCode || courseName}",
  "topics": [
    {
      "title": "Topic name (concise, 2-6 words)",
      "description": "1-sentence description of what this topic covers",
      "displayOrder": 1,
      "prerequisiteTitles": ["Title of prerequisite topic", ...]
    }
  ]
}

RULES:
1. Generate 8-20 topics that represent a logical learning progression from fundamentals to advanced.
2. Set displayOrder starting at 1, incrementing sequentially.
3. For prerequisiteTitles, list titles of topics that must be understood BEFORE this topic. Use exact titles from the list. Leave empty array if none.
4. Keep topic titles short (2-6 words).
5. Descriptions should be 1 sentence, under 20 words.
6. Return ONLY the JSON object.`;
}

/**
 * Generate a curriculum skeleton from an outline document or a course name.
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

  const prompt = hasOutline
    ? buildOutlineExtractionPrompt(outlineText, effectiveCourseCode)
    : buildGenericSkeletonPrompt(courseName, effectiveCourseCode);

  const raw = await callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" });
  const parsed = extractJSON(raw, "object");

  if (!parsed || !Array.isArray(parsed.topics) || parsed.topics.length === 0) {
    throw new Error("AI couldn't generate a valid topic skeleton. Try again.");
  }

  const topics = parsed.topics
    .filter((t) => t && t.title && t.title.trim())
    .map((t, idx) => ({
      title: t.title.trim(),
      description: t.description || null,
      displayOrder: t.displayOrder || idx + 1,
      prerequisiteTitles: Array.isArray(t.prerequisiteTitles) ? t.prerequisiteTitles : [],
    }));

  if (topics.length === 0) {
    throw new Error("No topics were extracted. Try with a different outline or course name.");
  }

  onProgress?.(`Generated ${topics.length} topics — saving to curriculum…`);

  // Save to server
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(effectiveCourseCode)}/topics`, {
    method: "POST",
    body: JSON.stringify({ topics, source }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save skeleton to server");
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
