import { API_BASE } from "../../lib/constants";
import { authFetch } from "../../lib/authToken.js";

async function req(path, { token, method = "GET", body } = {}) {
  const res = await authFetch(`${API_BASE}${path}`, {
    token,
    method,
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
// NOTE: server mounts this router at /study-group (no /api prefix) — like /classroom.
export const groupChatApi = {
  getMessages: ({ token, classroomId } = {}) =>
    req(`/study-group/${classroomId}/messages`, { token }),
  send: ({ token, classroomId, text, resourceId, liveCode, replyToId }) =>
    req(`/study-group/${classroomId}/messages`, {
      token,
      method: "POST",
      body: { text, resourceId, liveCode, replyToId },
    }),
  sendTyping: ({ token, classroomId, name } = {}) =>
    req(`/study-group/${classroomId}/typing`, { token, method: "POST", body: { name } }).catch(() => {}),
  react: ({ token, messageId, emoji }) =>
    req(`/study-group/messages/${messageId}/reactions`, { token, method: "POST", body: { emoji } }),
  pin: ({ token, messageId }) =>
    req(`/study-group/messages/${messageId}/pin`, { token, method: "POST" }),
  deleteMessage: ({ token, messageId }) =>
    req(`/study-group/messages/${messageId}`, { token, method: "DELETE" }),
};
