import { API_BASE } from "../../lib/constants";

function getAuthToken() {
  try {
    return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken || null;
  } catch {
    return null;
  }
}

async function request(path, options = {}) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function createLiveRoom(mcqResourceId) {
  return request("/api/live-quiz/create", {
    method: "POST",
    body: JSON.stringify({ mcqResourceId }),
  });
}

export function getLiveRoom(code) {
  return request(`/api/live-quiz/${encodeURIComponent(code)}`);
}

export function joinLiveRoom(code) {
  return request("/api/live-quiz/join", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function refreshTicket(roomId) {
  return request(`/api/live-quiz/${roomId}/ticket`, { method: "POST" });
}

export function getVoiceToken(roomId) {
  return request(`/api/live-quiz/${roomId}/voice-token`, { method: "POST" });
}

export function endLiveRoom(roomId) {
  return request(`/api/live-quiz/${roomId}/end`, { method: "POST" });
}

export function getWsUrl(roomId, ticket) {
  const base = API_BASE.startsWith("https://")
    ? API_BASE.replace("https://", "wss://")
    : API_BASE.startsWith("http://")
      ? API_BASE.replace("http://", "ws://")
      : `ws://${API_BASE}`;
  return `${base}/api/live-quiz/${roomId}/ws?ticket=${encodeURIComponent(ticket)}`;
}
