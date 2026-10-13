import { API_BASE } from "./constants.js";
import { authFetch } from "./authToken.js";

export async function submitReport({ targetType, targetId, reason, note }) {
  const res = await authFetch(`${API_BASE}/api/reports`, {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, reason, note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit report");
  }
  return res.json();
}

// Public copyright takedown notice — no account required (rights holders
// submit through /copyright without signing up).
export async function submitCopyrightReport(payload) {
  const res = await fetch(`${API_BASE}/api/reports/copyright`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit notice");
  }
  return res.json();
}
