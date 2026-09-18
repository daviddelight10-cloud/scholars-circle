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

export const feedApi = {
  getFeed: ({ token, scope = "forYou", subject, cursor } = {}) => {
    const params = new URLSearchParams({ scope });
    if (subject) params.set("subject", subject);
    if (cursor) params.set("cursor", cursor);
    return req(`/api/feed?${params}`, { token });
  },
  getCircle: ({ token } = {}) => req("/api/feed/circle", { token }),
  getSuggested: ({ token } = {}) => req("/api/feed/suggested", { token }),
  getTrending: ({ token } = {}) => req("/api/feed/trending", { token }),
  getFeedUser: ({ token, userId }) => req(`/api/feed/users/${userId}`, { token }),

  acceptAnswer: ({ token, postId, commentId }) =>
    req(`/api/feed/posts/${postId}/accept`, { token, method: "POST", body: { commentId } }),

  createPost: ({ token, text, kind = "post", resourceId } = {}) =>
    req("/api/feed/posts", { token, method: "POST", body: { text, kind, resourceId } }),
  deletePost: ({ token, id }) => req(`/api/feed/posts/${id}`, { token, method: "DELETE" }),
  toggleLike: ({ token, id }) => req(`/api/feed/posts/${id}/like`, { token, method: "POST" }),

  getComments: ({ token, postId }) => req(`/api/feed/posts/${postId}/comments`, { token }),
  addComment: ({ token, postId, text }) =>
    req(`/api/feed/posts/${postId}/comments`, { token, method: "POST", body: { text } }),
  toggleCommentLike: ({ token, commentId }) =>
    req(`/api/feed/comments/${commentId}/like`, { token, method: "POST" }),

  // Resources (existing endpoints)
  getMyResources: ({ token } = {}) => req("/api/resources?mine=1", { token }),
  getMyBookmarks: ({ token } = {}) => req("/api/resources/bookmarks", { token }),
  toggleBookmark: ({ token, resourceId, bookmarked }) =>
    req(`/api/resources/${resourceId}/bookmark`, { token, method: bookmarked ? "DELETE" : "POST" }),
  getResourceComments: ({ token, resourceId }) => req(`/api/resources/${resourceId}/comments`, { token }),
  addResourceComment: ({ token, resourceId, text }) =>
    req(`/api/resources/${resourceId}/comments`, { token, method: "POST", body: { text } }),

  // Follows (existing endpoints)
  follow: ({ token, userId }) => req(`/users/${userId}/follow`, { token, method: "POST" }),
  unfollow: ({ token, userId }) => req(`/users/${userId}/follow`, { token, method: "DELETE" }),

  // Public study rooms — "go live with friends"
  getPublicRooms: ({ token } = {}) => req("/study-group/public-rooms", { token }),
  createPublicRoom: ({ token, name, subject, focus, maxSeats, resourceId }) =>
    req("/study-group/public-rooms", { token, method: "POST", body: { name, subject, focus, maxSeats, resourceId } }),
  joinRoom: ({ token, roomId }) => req(`/study-group/study-rooms/${roomId}/join`, { token, method: "POST" }),
  leaveRoom: ({ token, roomId }) => req(`/study-group/study-rooms/${roomId}/leave`, { token, method: "POST" }),
  endRoom: ({ token, roomId }) => req(`/study-group/study-rooms/${roomId}/end`, { token, method: "POST" }),

  // Classroom live sessions (only when user has classrooms)
  getLiveSessions: ({ token } = {}) => req("/live-sessions/live", { token }),
  getUpcomingSessions: ({ token } = {}) => req("/live-sessions/upcoming", { token }),
  joinSession: ({ token, sessionId }) => req(`/live-sessions/${sessionId}/join`, { token, method: "POST" }),

  // Streak chip
  getFsrsStats: ({ token } = {}) => req("/api/resources/fsrs/stats", { token }),
  getFsrsAnalytics: ({ token } = {}) => req("/api/resources/fsrs/analytics?days=30", { token }),
};
