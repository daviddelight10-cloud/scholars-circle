import { API_BASE } from "./constants.js";

function authFetch(url, opts = {}) {
  let token = null;
  try {
    token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}")?.authToken;
  } catch {}
  const headers = { "Content-Type": "application/json", ...opts.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

export async function getResourceByShareToken(shareToken) {
  const res = await authFetch(`${API_BASE}/api/resources/${shareToken}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load shared material");
  }
  return res.json();
}

export async function bookmarkResource(resourceId) {
  const res = await authFetch(`${API_BASE}/api/resources/${resourceId}/bookmark`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to save material");
  }
  return res.json();
}

export async function unbookmarkResource(resourceId) {
  const res = await authFetch(`${API_BASE}/api/resources/${resourceId}/bookmark`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to remove saved material");
  }
  return res.json();
}
