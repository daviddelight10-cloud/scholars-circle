import { API_BASE } from "../../lib/constants";
import { fetchWithAuth } from "../../lib/authToken.js";

async function req(path, { method = "GET", token, body, formData } = {}) {
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    method,
    token,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const classroomApi = {
  my: (token) => req("/classroom/my", { token }),
  get: (id, token) => req(`/classroom/${id}`, { token }),
  attention: (token) => req("/classroom/attention", { token }),
  create: (payload, token) => req("/classroom", { method: "POST", token, body: payload }),
  joinByCode: (code, token) => req("/classroom/join-by-code", { method: "POST", token, body: { code } }),
  join: (id, token) => req(`/classroom/${id}/join`, { method: "POST", token }),
  addLink: (id, payload, token) => req(`/classroom/${id}/links`, { method: "POST", token, body: payload }),
  addAnnouncement: (id, payload, token) => req(`/classroom/${id}/announcements`, { method: "POST", token, body: payload }),
  markRead: (announcementId, token) => req(`/classroom/announcements/${announcementId}/read`, { method: "POST", token }),
  createExam: (id, payload, token) => req(`/classroom/${id}/exams`, { method: "POST", token, body: payload }),
  uploadDocument: (id, file, token) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    return req(`/classroom/${id}/documents`, { method: "POST", token, formData });
  },
  deleteDocument: (id, documentId, token) => req(`/classroom/${id}/documents/${documentId}`, { method: "DELETE", token }),
  uploadDocumentProgress: (id, file, token, onProgress) => {
    // XHR for real upload progress (fetch can't report upload progress).
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/classroom/${id}/documents`);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else reject(new Error(data.error || `Upload failed (${xhr.status})`));
        } catch { reject(new Error("Upload failed")); }
      };
      xhr.onerror = () => reject(new Error("Network error during upload"));
      xhr.send(formData);
    });
  },
};

// Stable gradient palette per class name — Google-Classroom-style color coding.
const PALETTES = [
  ["#7c5cff", "#4a2db8"], ["#0ea5e9", "#065f8f"], ["#10b981", "#065f46"],
  ["#f59e0b", "#92400e"], ["#ef4444", "#7f1d1d"], ["#ec4899", "#831843"],
  ["#8b5cf6", "#4c1d95"], ["#14b8a6", "#134e4a"],
];
export function classPalette(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

export function initials(name) {
  if (!name) return "?";
  const w = name.trim().split(/\s+/);
  return ((w[0]?.[0] || "?") + (w[1]?.[0] || "")).toUpperCase();
}

export function attentionBadges(counts) {
  const out = [];
  if (counts?.attendanceOpen > 0) out.push({ icon: "📋", label: "Attendance open", kind: "live" });
  if (counts?.testsOpen > 0) out.push({ icon: "✍️", label: `${counts.testsOpen} test${counts.testsOpen > 1 ? "s" : ""} open`, kind: "live" });
  if (counts?.assignmentsDue > 0) out.push({ icon: "📝", label: `${counts.assignmentsDue} due`, kind: "due" });
  if (counts?.unreadImportant > 0) out.push({ icon: "⚠️", label: "Important", kind: "warn" });
  return out;
}
