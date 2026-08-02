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
 * Build a prompt for matching a document to curriculum topics.
 */
function buildMatchingPrompt(resourceTitle, resourceDescription, resourceType, topics) {
  const topicList = topics.map((t, i) => `${i + 1}. ${t.title}${t.description ? ` — ${t.description}` : ""}`).join("\n");

  return `You are an expert at matching study materials to curriculum topics.

DOCUMENT:
- Title: ${resourceTitle}
- Type: ${resourceType}
- Description/Content: ${(resourceDescription || "No description available").slice(0, 3000)}

CURRICULUM TOPICS:
${topicList}

Match this document to the most relevant curriculum topics (1-3 topics max).

Return ONLY a valid JSON array (no markdown):
[
  { "topicId": "topic-id-from-list", "confidence": 0.95 }
]

RULES:
1. Only match to topics that are genuinely relevant to the document content.
2. Confidence should be 0.0-1.0, where 1.0 means perfect match.
3. Only include matches with confidence >= 0.5.
4. Return at most 3 matches.
5. Use the exact topicId values from the list above.
6. If no topics are relevant, return an empty array [].`;
}

/**
 * Match a single resource to curriculum topics using AI.
 *
 * @param {object} resource - { id, title, description, contentType }
 * @param {Array} topics - Array of { id, title, description }
 * @param {function} [onProgress] - Progress callback
 * @returns {Promise<Array<{topicId: string, confidence: number}>>}
 */
export async function matchResourceToTopics(resource, topics, onProgress) {
  if (!topics || topics.length === 0) return [];

  onProgress?.(`Matching "${resource.title}" to ${topics.length} topics…`);

  const prompt = buildMatchingPrompt(
    resource.title,
    resource.description,
    resource.contentType,
    topics
  );

  const raw = await callAI(prompt, { provider: "openrouter", model: "google/gemini-2.5-flash" });

  let matches;
  try {
    matches = extractJSON(raw, "array");
  } catch {
    return [];
  }

  if (!Array.isArray(matches)) return [];

  return matches
    .filter((m) => m && m.topicId && typeof m.confidence === "number" && m.confidence >= 0.5)
    .slice(0, 3);
}

/**
 * Save document-topic matches to the server.
 *
 * @param {string} resourceId
 * @param {Array<{topicId: string, confidence: number}>} matches
 * @returns {Promise<void>}
 */
export async function saveTopicMatches(resourceId, matches) {
  for (const match of matches) {
    try {
      await authFetch(`${API_BASE}/api/curriculum/matches`, {
        method: "POST",
        body: JSON.stringify({
          resourceId,
          topicId: match.topicId,
          confidence: match.confidence,
          matchSource: "ai",
        }),
      });
    } catch (err) {
      console.warn("Failed to save topic match:", err.message);
    }
  }
}

/**
 * Match multiple resources to curriculum topics (batch mode).
 * Processes resources sequentially to avoid rate limits.
 *
 * @param {Array} resources - Array of { id, title, description, contentType }
 * @param {Array} topics - Array of { id, title, description }
 * @param {function} [onProgress] - Progress callback (currentIndex, total, resourceName)
 * @returns {Promise<number>} Number of matches created
 */
export async function batchMatchResources(resources, topics, onProgress) {
  if (!topics || topics.length === 0 || !resources || resources.length === 0) return 0;

  let matchCount = 0;

  for (let i = 0; i < resources.length; i++) {
    const resource = resources[i];
    onProgress?.(i, resources.length, resource.title);

    try {
      const matches = await matchResourceToTopics(resource, topics);
      if (matches.length > 0) {
        await saveTopicMatches(resource.id, matches);
        matchCount += matches.length;
      }
    } catch (err) {
      console.warn(`Failed to match resource "${resource.title}":`, err.message);
    }
  }

  onProgress?.(resources.length, resources.length, "Done");
  return matchCount;
}

/**
 * Trigger retroactive matching for a course.
 * Fetches resources and topics from the server, then matches them client-side.
 *
 * @param {string} courseCode
 * @param {function} [onProgress] - Progress callback
 * @returns {Promise<{matchCount: number, resourceCount: number, topicCount: number}>}
 */
export async function retroactiveMatch(courseCode, onProgress) {
  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/retroactive-match`, {
    method: "POST",
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to start retroactive matching");
  }

  const data = await res.json();

  if (!data.resources || data.resources.length === 0 || !data.topics || data.topics.length === 0) {
    return { matchCount: 0, resourceCount: data.resourceCount || 0, topicCount: data.topicCount || 0 };
  }

  const matchCount = await batchMatchResources(data.resources, data.topics, onProgress);

  return { matchCount, resourceCount: data.resourceCount, topicCount: data.topicCount };
}
