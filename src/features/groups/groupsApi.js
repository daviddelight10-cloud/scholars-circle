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
};
