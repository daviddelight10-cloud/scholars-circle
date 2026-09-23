import { API_BASE } from "../../lib/constants";

function authHeaders(token) {
  if (token) return { Authorization: `Bearer ${token}` };
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return authData.authToken ? { Authorization: `Bearer ${authData.authToken}` } : {};
  } catch {
    return {};
  }
}

async function req(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { ...authHeaders(token), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export const messagesApi = {
  getInbox: ({ token } = {}) => req("/api/messages/inbox", { token }),
  getUnreadCount: ({ token } = {}) => req("/api/messages/unread-count", { token }),
  searchPeers: ({ token, q } = {}) =>
    req(`/api/messages/peers${q ? `?q=${encodeURIComponent(q)}` : ""}`, { token }),
  getThread: ({ token, userId, before } = {}) =>
    req(`/api/messages/thread/${userId}${before ? `?before=${encodeURIComponent(before)}` : ""}`, { token }),
  send: ({ token, toUserId, content }) =>
    req("/api/messages", { token, method: "POST", body: { toUserId, content } }),
  deleteMessage: ({ token, id }) => req(`/api/messages/${id}`, { token, method: "DELETE" }),
};
