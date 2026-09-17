import { API_BASE } from "./constants.js";

export async function submitReport({ targetType, targetId, reason, note }) {
  let token = null;
  try {
    token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}")?.authToken;
  } catch {}
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/reports`, {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ targetType, targetId, reason, note }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to submit report");
  }
  return res.json();
}
