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
  // Returns { messages, peerTyping, peerOnline }
  getThread: ({ token, userId, before } = {}) =>
    req(`/api/messages/thread/${userId}${before ? `?before=${encodeURIComponent(before)}` : ""}`, { token }),
  send: ({ token, toUserId, content, resourceId, replyToId }) =>
    req("/api/messages", { token, method: "POST", body: { toUserId, content, resourceId, replyToId } }),
  sendTyping: ({ token, toUserId } = {}) =>
    req("/api/messages/typing", { token, method: "POST", body: { toUserId } }).catch(() => {}),
  react: ({ token, id, emoji }) =>
    req(`/api/messages/${id}/reactions`, { token, method: "POST", body: { emoji } }),
  deleteMessage: ({ token, id }) => req(`/api/messages/${id}`, { token, method: "DELETE" }),
};

// Study-group endpoints used by GroupChat (kept here so chat API lives in one file)
export const groupChatApi = {
  getMessages: ({ token, classroomId } = {}) =>
    req(`/api/study-group/${classroomId}/messages`, { token }),
  send: ({ token, classroomId, text, resourceId, liveCode, replyToId }) =>
    req(`/api/study-group/${classroomId}/messages`, {
      token,
      method: "POST",
      body: { text, resourceId, liveCode, replyToId },
    }),
  sendTyping: ({ token, classroomId, name } = {}) =>
    req(`/api/study-group/${classroomId}/typing`, { token, method: "POST", body: { name } }).catch(() => {}),
  react: ({ token, messageId, emoji }) =>
    req(`/api/study-group/messages/${messageId}/reactions`, { token, method: "POST", body: { emoji } }),
  pin: ({ token, messageId }) =>
    req(`/api/study-group/messages/${messageId}/pin`, { token, method: "POST" }),
  deleteMessage: ({ token, messageId }) =>
    req(`/api/study-group/messages/${messageId}`, { token, method: "DELETE" }),
};
