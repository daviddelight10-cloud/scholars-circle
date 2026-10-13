import { API_BASE } from "../../lib/constants";
import { fetchWithAuth } from "../../lib/authToken.js";

async function req(path, { method = "GET", token, body, formData } = {}) {
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    token,
    method,
    body: formData ? formData : body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const assignmentsApi = {
  create: (classroomId, payload, token) => req(`/classroom-assignments/classroom/${classroomId}`, { method: "POST", token, body: payload }),
  list: (classroomId, token) => req(`/classroom-assignments/classroom/${classroomId}`, { token }),
  get: (id, token) => req(`/classroom-assignments/${id}`, { token }),
  delete: (id, token) => req(`/classroom-assignments/${id}`, { method: "DELETE", token }),
  submit: (id, { content, file }, token) => {
    const fd = new FormData();
    if (content) fd.append("content", content);
    if (file) fd.append("file", file);
    return req(`/classroom-assignments/${id}/submit`, { method: "POST", token, formData: fd });
  },
  grade: (submissionId, payload, token) =>
    req(`/classroom-assignments/submissions/${submissionId}/grade`, { method: "POST", token, body: payload }),
  downloadUrl: (submissionId, token) =>
    `${API_BASE}/classroom-assignments/submissions/${submissionId}/download?_=${encodeURIComponent(token || "")}`,
  gradebook: (classroomId, token) => req(`/classroom-assignments/classroom/${classroomId}/gradebook`, { token })
};
