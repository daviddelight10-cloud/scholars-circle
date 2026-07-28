const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const liveSessionsApi = {
  schedule: (classroomId, payload, token) =>
    req(`/live-sessions/classrooms/${classroomId}`, { method: "POST", token, body: payload }),
  listForClassroom: (classroomId, token) =>
    req(`/live-sessions/classrooms/${classroomId}`, { token }),
  getLive: (token) => req(`/live-sessions/live`, { token }),
  getUpcoming: (token) => req(`/live-sessions/upcoming`, { token }),
  get: (id, token) => req(`/live-sessions/${id}`, { token }),
  start: (id, token) => req(`/live-sessions/${id}/start`, { method: "POST", token }),
  end: (id, token) => req(`/live-sessions/${id}/end`, { method: "POST", token }),
  cancel: (id, token) => req(`/live-sessions/${id}`, { method: "DELETE", token }),
  recordJoin: (id, token) => req(`/live-sessions/${id}/join`, { method: "POST", token }),
  recordLeave: (id, token) => req(`/live-sessions/${id}/leave`, { method: "POST", token })
};
