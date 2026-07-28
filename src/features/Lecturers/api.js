// API client for lecturer endpoints
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function request(path, { method = "GET", token, body } = {}) {
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

export const lecturersApi = {
  list: ({ token, department, institution, search } = {}) => {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    if (institution) params.set("institution", institution);
    if (search) params.set("search", search);
    const qs = params.toString();
    return request(`/lecturers${qs ? `?${qs}` : ""}`, { token });
  },
  get: (id, token) => request(`/lecturers/${id}`, { token }),
  getMine: (token) => request(`/lecturers/me`, { token }),
  saveMine: (data, token) => request(`/lecturers/me`, { method: "POST", token, body: data }),
  rate: (id, score, comment, token) => request(`/lecturers/${id}/rate`, { method: "POST", token, body: { score, comment } }),
  createPost: (id, post, token) => request(`/lecturers/${id}/posts`, { method: "POST", token, body: post }),
  deletePost: (postId, token) => request(`/lecturers/posts/${postId}`, { method: "DELETE", token }),
  // Messaging
  sendMessage: ({ toLecturerId, toUserId, content }, token) =>
    request(`/lecturers/messages`, { method: "POST", token, body: { toLecturerId, toUserId, content } }),
  getThread: (otherUserId, token) => request(`/lecturers/messages/thread/${otherUserId}`, { token }),
  getInbox: (token) => request(`/lecturers/messages/inbox`, { token }),
  unreadCount: (token) => request(`/lecturers/messages/unread-count`, { token })
};
