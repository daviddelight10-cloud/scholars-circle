import { API_BASE as BASE } from "./constants.js";

import { authFetch } from "./authToken.js";

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
