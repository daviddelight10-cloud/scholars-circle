import { API_BASE as BASE } from "./constants.js";

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

export async function getMyProfile() {
  const res = await authFetch(`${BASE}/api/profile`);
  if (!res.ok) return null;
  return res.json();
}

export async function saveMyProfile(data) {
  const res = await authFetch(`${BASE}/api/profile`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save profile");
  }
  return res.json();
}

export async function deleteMyProfile() {
  const res = await authFetch(`${BASE}/api/profile`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete profile");
  return res.json();
}
