import { API_BASE } from "../../lib/constants";
import { fetchWithAuth } from "../../lib/authToken.js";

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    method,
    token,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const attendanceApi = {
  open: (classroomId, payload, token) => req(`/attendance/classrooms/${classroomId}/sessions`, { method: "POST", token, body: payload }),
  live: (id, token) => req(`/attendance/sessions/${id}/live`, { token }),
  close: (id, token) => req(`/attendance/sessions/${id}/close`, { method: "POST", token }),
  setMark: (id, userId, present, token) => req(`/attendance/sessions/${id}/marks/${userId}`, { method: "PUT", token, body: { present } }),
  report: (classroomId, token) => req(`/attendance/classrooms/${classroomId}/report`, { token }),
  hostActive: (classroomId, token) => req(`/attendance/classrooms/${classroomId}/host-active`, { token }),
  active: (token, classroomId) => req(`/attendance/active${classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : ""}`, { token }),
  mark: (id, payload, token) => req(`/attendance/sessions/${id}/mark`, { method: "POST", token, body: payload }),
  mine: (token, classroomId) => req(`/attendance/mine${classroomId ? `?classroomId=${encodeURIComponent(classroomId)}` : ""}`, { token }),
};

// One-shot geolocation → { lat, lng, accuracy } or null (denied / unavailable / timeout)
export function getPosition(timeout = 8000) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout, maximumAge: 15000 }
    );
  });
}
