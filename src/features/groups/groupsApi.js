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

export const groupsApi = {
  myGroups: ({ token } = {}) => req("/classroom/groups/my", { token }),
  discover: ({ token, q, subject } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (subject) params.set("subject", subject);
    return req(`/classroom/groups/discover${params.size ? `?${params}` : ""}`, { token });
  },
  preview: ({ token, code }) => req(`/classroom/groups/preview/${encodeURIComponent(code)}`, { token }),
  create: ({ token, name, subject, description, isPublic }) =>
    req("/classroom/groups", { token, method: "POST", body: { name, subject, description, isPublic } }),
  join: ({ token, code, groupId }) =>
    req("/classroom/groups/join", { token, method: "POST", body: { code, groupId } }),
  leave: ({ token, id }) => req(`/classroom/groups/${id}/leave`, { token, method: "POST" }),
  update: ({ token, id, ...fields }) =>
    req(`/classroom/groups/${id}`, { token, method: "PATCH", body: fields }),
  remove: ({ token, id }) => req(`/classroom/groups/${id}`, { token, method: "DELETE" }),
  detail: ({ token, id }) => req(`/classroom/${id}`, { token }),
  // Group chat messages live on the study-group router (classroomId === group id).
  sendMessage: ({ token, id, text, resourceId, liveCode } = {}) =>
    req(`/study-group/${id}/messages`, { token, method: "POST", body: { text, resourceId, liveCode } }),
  // Group XP: member contribution board inside a group
  groupXp: ({ token, id } = {}) => req(`/study-group/${id}/xp`, { token }),
  // Public weekly/all-time groups leaderboard. scope: "all" | "university",
  // sort: "xp" | "rating" (Elo hall of fame).
  groupsBoard: ({ token, period = "week", scope = "all", sort } = {}) => {
    const p = new URLSearchParams({ period, scope });
    if (sort) p.set("sort", sort);
    return req(`/study-group/groups/leaderboard?${p}`, { token });
  },
  members: ({ token, id } = {}) => req(`/study-group/${id}/members`, { token }),
  promote: ({ token, id, userId, role }) =>
    req(`/study-group/${id}/promote`, { token, method: "POST", body: { userId, role } }),
  removeMember: ({ token, id, userId }) =>
    req(`/study-group/${id}/members/${userId}/remove`, { token, method: "POST" }),
  // Ring the group into a live session/battle (5-min caller cooldown server-side).
  ring: ({ token, id, code }) => req(`/study-group/${id}/ring`, { token, method: "POST", body: { code } }),
  // Group-vs-group battles
  // Opponent search for challenges — includes private clans (name/desc/joinCode).
  searchOpponents: ({ token, q, from } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    return req(`/api/battles/opponents${params.size ? `?${params}` : ""}`, { token });
  },
  battlesMine: ({ token } = {}) => req("/api/battles/mine", { token }),
  battleDetail: ({ token, id }) => req(`/api/battles/${id}`, { token }),
  groupBattles: ({ token, id } = {}) => req(`/api/battles/group/${id}`, { token }),
  createBattle: ({ token, ...body }) => req("/api/battles", { token, method: "POST", body }),
  acceptBattle: ({ token, id, lineupIds }) =>
    req(`/api/battles/${id}/accept`, { token, method: "POST", body: { lineupIds } }),
  declineBattle: ({ token, id }) => req(`/api/battles/${id}/decline`, { token, method: "POST" }),
};
