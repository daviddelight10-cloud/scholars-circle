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

// ─── Folders CRUD ────────────────────────────────────────────────────

export async function listFolders() {
  const res = await authFetch(`${API_BASE}/api/folders`);
  if (!res.ok) throw new Error("Failed to load folders");
  return res.json();
}

export async function createFolder(data) {
  const res = await authFetch(`${API_BASE}/api/folders`, {
    method: "POST",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to create folder");
  }
  return res.json();
}

export async function getFolder(id) {
  const res = await authFetch(`${API_BASE}/api/folders/${id}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load folder");
  }
  return res.json();
}

export async function getFolderByShareToken(shareToken) {
  const res = await authFetch(`${API_BASE}/api/folders/shared/${shareToken}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load shared folder");
  }
  return res.json();
}

export async function updateFolder(id, data) {
  const res = await authFetch(`${API_BASE}/api/folders/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to update folder");
  }
  return res.json();
}

export async function deleteFolder(id) {
  const res = await authFetch(`${API_BASE}/api/folders/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to delete folder");
  }
  return res.json();
}

// ─── Folder Bookmarks ─────────────────────────────────────────────────

export async function bookmarkFolder(folderId) {
  const res = await authFetch(`${API_BASE}/api/folders/${folderId}/bookmark`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to bookmark folder");
  }
  return res.json();
}

export async function unbookmarkFolder(folderId) {
  const res = await authFetch(`${API_BASE}/api/folders/${folderId}/bookmark`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to remove folder bookmark");
  }
  return res.json();
}

// ─── Pending Contributions (staff only) ──────────────────────────────

export async function getPendingResources(folderId) {
  const res = await authFetch(`${API_BASE}/api/folders/${folderId}/pending`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to load pending resources");
  }
  return res.json();
}
