import { API_BASE } from "../../lib/constants";
import { fetchWithAuth } from "../../lib/authToken.js";

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    method,
    token,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const classTestApi = {
  list: (classroomId, token) => req(`/class-tests/classrooms/${classroomId}/tests`, { token }),
  create: (classroomId, payload, token) => req(`/class-tests/classrooms/${classroomId}/tests`, { method: "POST", token, body: payload }),
  get: (id, token) => req(`/class-tests/tests/${id}`, { token }),
  update: (id, payload, token) => req(`/class-tests/tests/${id}`, { method: "PATCH", token, body: payload }),
  remove: (id, token) => req(`/class-tests/tests/${id}`, { method: "DELETE", token }),
  results: (id, token) => req(`/class-tests/tests/${id}/results`, { token }),
  analysis: (id, token) => req(`/class-tests/tests/${id}/analysis`, { token }),
  start: (id, details, token) => req(`/class-tests/tests/${id}/start`, { method: "POST", token, body: details }),
  submit: (id, answers, token) => req(`/class-tests/tests/${id}/submit`, { method: "POST", token, body: { answers } }),
  mine: (id, token) => req(`/class-tests/tests/${id}/my`, { token }),
  flagFocus: (id, token) => req(`/class-tests/tests/${id}/focus`, { method: "POST", token }),
  // owner actions
  share: (id, enabled, token) => req(`/class-tests/tests/${id}/share`, { method: "POST", token, body: { enabled } }),
  clone: (id, classroomId, token, extra = {}) => req(`/class-tests/tests/${id}/clone`, { method: "POST", token, body: { classroomId, ...extra } }),
  resetAttempt: (id, attemptId, token) => req(`/class-tests/tests/${id}/attempts/${attemptId}/reset`, { method: "POST", token }),
  forceSubmit: (id, token) => req(`/class-tests/tests/${id}/force-submit`, { method: "POST", token }),
  adjustScore: (id, attemptId, score, note, token) => req(`/class-tests/tests/${id}/attempts/${attemptId}/score`, { method: "PATCH", token, body: { score, note } }),
  // share link (public-ish)
  shareMeta: (shareToken, token) => req(`/class-tests/share/${shareToken}`, { token }),
  shareByCode: (code, token) => req(`/class-tests/share/code/${encodeURIComponent(code)}`, { token }),
  shareStart: (shareToken, details, token) => req(`/class-tests/share/${shareToken}/start`, { method: "POST", token, body: details }),
  // Question bank + authoring
  bankQuestions: (subjectId, token) => req(`/questions?subjectId=${encodeURIComponent(subjectId)}`, { token }),
  addBankQuestion: (payload, token) => req(`/questions`, { method: "POST", token, body: payload }),
};

export const shareUrl = (shareToken) => `${window.location.origin}/t/${shareToken}`;

export function testPhase(test, now = Date.now()) {
  const open = new Date(test.opensAt).getTime();
  const close = new Date(test.closesAt).getTime();
  if (now < open) return "upcoming";
  if (now > close) return "closed";
  return "open";
}

export function fmtWindow(test) {
  const f = (d) => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  return `${f(test.opensAt)} → ${f(test.closesAt)}`;
}
