import { API_BASE } from "./constants";

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

const CACHE_PREFIX = "sc_study_cache_";
const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function slugify(topic) {
  return topic.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function lsKey(topic) {
  return `${CACHE_PREFIX}${slugify(topic)}`;
}

/**
 * Get cached study content for a topic.
 * Tries localStorage first (fast), then falls back to server.
 * Returns null if no cache exists or cache is stale.
 */
export async function getStudyCache(topic) {
  if (!topic || !topic.trim()) return null;
  const topicStr = topic.trim();

  // 1. Try localStorage
  try {
    const raw = localStorage.getItem(lsKey(topicStr));
    if (raw) {
      const data = JSON.parse(raw);
      if (data.updatedAt && Date.now() - new Date(data.updatedAt).getTime() < STALE_MS) {
        return data;
      }
    }
  } catch {}

  // 2. Try server
  try {
    const res = await authFetch(`${API_BASE}/api/study-cache/${encodeURIComponent(topicStr)}`);
    if (res.ok) {
      const data = await res.json();
      // Save to localStorage for next time
      try { localStorage.setItem(lsKey(topicStr), JSON.stringify(data)); } catch {}
      return data;
    }
  } catch {}

  return null;
}

/**
 * Save study content to both localStorage and server.
 * Only saves fields that are provided (partial updates supported).
 */
export async function saveStudyCache(topic, data) {
  if (!topic || !topic.trim()) return;
  const topicStr = topic.trim();

  // Merge with existing localStorage data (partial update)
  let merged = {};
  try {
    const raw = localStorage.getItem(lsKey(topicStr));
    if (raw) merged = JSON.parse(raw);
  } catch {}

  if (data.roadmap !== undefined) merged.roadmap = data.roadmap;
  if (data.flashcards !== undefined) merged.flashcards = data.flashcards;
  if (data.explanations !== undefined) {
    const existing = merged.explanations || {};
    for (const [key, val] of Object.entries(data.explanations)) {
      existing[key] = { ...(existing[key] || {}), ...val };
    }
    merged.explanations = existing;
  }
  if (data.courseCode !== undefined) merged.courseCode = data.courseCode;
  merged.updatedAt = new Date().toISOString();

  // Save to localStorage
  try { localStorage.setItem(lsKey(topicStr), JSON.stringify(merged)); } catch {}

  // Save to server (fire-and-forget, but await for correctness)
  try {
    await authFetch(`${API_BASE}/api/study-cache`, {
      method: "POST",
      body: JSON.stringify({
        topic: topicStr,
        courseCode: merged.courseCode,
        roadmap: merged.roadmap,
        flashcards: merged.flashcards,
        explanations: merged.explanations,
      }),
    });
  } catch {}

  return merged;
}

/**
 * Clear cache for a topic from both localStorage and server.
 */
export async function clearStudyCache(topic) {
  if (!topic || !topic.trim()) return;
  const topicStr = topic.trim();

  try { localStorage.removeItem(lsKey(topicStr)); } catch {}

  try {
    await authFetch(`${API_BASE}/api/study-cache/${encodeURIComponent(topicStr)}`, {
      method: "DELETE",
    });
  } catch {}
}
