import { API_BASE } from "./constants";

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

/**
 * Trigger retroactive matching for a course.
 * All AI matching runs server-side — this is just a thin API wrapper.
 *
 * @param {string} courseCode
 * @param {function} [onProgress] - Progress callback (kept for backward compat, not called server-side)
 * @returns {Promise<{matchCount: number, resourceCount: number}>}
 */
export async function retroactiveMatch(courseCode, onProgress, folderId) {
  onProgress?.(0, 0, "Starting server-side matching…");

  const res = await authFetch(`${API_BASE}/api/curriculum/${encodeURIComponent(courseCode)}/retroactive-match`, {
    method: "POST",
    body: JSON.stringify({ folderId: folderId || undefined }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to run retroactive matching");
  }

  const data = await res.json();

  onProgress?.(data.resourceCount || 0, data.resourceCount || 0, `Done — ${data.matchCount || 0} matches`);

  return {
    matchCount: data.matchCount || 0,
    resourceCount: data.resourceCount || 0,
    topicCount: data.topicCount || 0,
  };
}
