import { API_BASE } from "./constants.js";
import { authFetch } from "./authToken.js";

export async function getResourceByShareToken(shareToken) {
  const res = await authFetch(`${API_BASE}/api/resources/${shareToken}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load shared material");
  }
  return res.json();
}

export async function bookmarkResource(resourceId, folderId) {
  const res = await authFetch(`${API_BASE}/api/resources/${resourceId}/bookmark`, {
    method: "POST",
    body: JSON.stringify(folderId ? { folderId } : {}),
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
