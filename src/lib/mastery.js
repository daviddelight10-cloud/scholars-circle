const BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  return fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
  });
}

// Call after a practice session finishes
// results: [{ questionId, correct }]
export async function submitMasterySession(subjectId, results, topicId = null) {
  try {
    const res = await authFetch(`${BASE}/api/mastery/session`, {
      method: "POST",
      body: JSON.stringify({ subjectId, topicId, results }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Anonymised peer comparison for a subject
export async function getPeerComparison(subjectId) {
  try {
    const res = await authFetch(`${BASE}/api/mastery/peer/${subjectId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Per-question mastery grid
export async function getMasteryGrid(subjectId) {
  try {
    const res = await authFetch(`${BASE}/api/mastery/grid/${subjectId}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
