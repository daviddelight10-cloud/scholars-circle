const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

function headers(token) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

// ─── Leagues ─────────────────────────────────────────────────────────
export async function getMyLeague(token) {
  const r = await fetch(`${API_BASE}/gamification/league`, { headers: headers(token) });
  return r.json();
}

export async function getLeagueStandings(token, tier) {
  const q = tier ? `?tier=${tier}` : "";
  const r = await fetch(`${API_BASE}/gamification/league/standings${q}`, { headers: headers(token) });
  return r.json();
}

// ─── Badges ──────────────────────────────────────────────────────────
export async function getAllBadges(token) {
  const r = await fetch(`${API_BASE}/gamification/badges`, { headers: headers(token) });
  return r.json();
}

export async function getMyBadges(token) {
  const r = await fetch(`${API_BASE}/gamification/my-badges`, { headers: headers(token) });
  return r.json();
}

export async function checkBadges(token) {
  const r = await fetch(`${API_BASE}/gamification/check-badges`, { method: "POST", headers: headers(token) });
  return r.json();
}

// ─── Weekly Challenges ───────────────────────────────────────────────
export async function getChallenges(token, classroomId) {
  const r = await fetch(`${API_BASE}/gamification/challenges?classroomId=${classroomId}`, { headers: headers(token) });
  return r.json();
}

export async function createChallenge(token, data) {
  const r = await fetch(`${API_BASE}/gamification/challenges`, { method: "POST", headers: headers(token), body: JSON.stringify(data) });
  return r.json();
}

export async function submitChallenge(token, challengeId, score, total) {
  const r = await fetch(`${API_BASE}/gamification/challenges/${challengeId}/submit`, {
    method: "POST", headers: headers(token), body: JSON.stringify({ score, total }),
  });
  return r.json();
}

// ─── Duels ───────────────────────────────────────────────────────────
export async function getMyDuels(token) {
  const r = await fetch(`${API_BASE}/gamification/duels`, { headers: headers(token) });
  return r.json();
}

export async function getDuelDetail(token, duelId) {
  const r = await fetch(`${API_BASE}/gamification/duels/${duelId}`, { headers: headers(token) });
  return r.json();
}

export async function createDuel(token, challengedId, subjectId) {
  const r = await fetch(`${API_BASE}/gamification/duels`, {
    method: "POST", headers: headers(token), body: JSON.stringify({ challengedId, subjectId }),
  });
  return r.json();
}

export async function acceptDuel(token, duelId) {
  const r = await fetch(`${API_BASE}/gamification/duels/${duelId}/accept`, { method: "POST", headers: headers(token) });
  return r.json();
}

export async function declineDuel(token, duelId) {
  const r = await fetch(`${API_BASE}/gamification/duels/${duelId}/decline`, { method: "POST", headers: headers(token) });
  return r.json();
}

export async function answerDuel(token, duelId, questionId, selected) {
  const r = await fetch(`${API_BASE}/gamification/duels/${duelId}/answer`, {
    method: "POST", headers: headers(token), body: JSON.stringify({ questionId, selected }),
  });
  return r.json();
}

// ─── Wall ────────────────────────────────────────────────────────────
export async function getWallPosts(token, classroomId, cursor) {
  let url = `${API_BASE}/wall?classroomId=${classroomId}`;
  if (cursor) url += `&cursor=${cursor}`;
  const r = await fetch(url, { headers: headers(token) });
  return r.json();
}

export async function createWallPost(token, classroomId, content, kind, metadata) {
  const r = await fetch(`${API_BASE}/wall`, {
    method: "POST", headers: headers(token),
    body: JSON.stringify({ classroomId, content, kind, metadata }),
  });
  return r.json();
}

export async function deleteWallPost(token, postId) {
  const r = await fetch(`${API_BASE}/wall/${postId}`, { method: "DELETE", headers: headers(token) });
  return r.json();
}

export async function reactToPost(token, postId, emoji) {
  const r = await fetch(`${API_BASE}/wall/${postId}/react`, {
    method: "POST", headers: headers(token), body: JSON.stringify({ emoji }),
  });
  return r.json();
}
