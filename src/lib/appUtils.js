import { LEAGUES, API_BASE } from "./constants";

export function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function percent(score, total) {
  if (!total) return 0;
  return Math.round((score / total) * 100);
}

export function todayKey() {
  return new Date().toDateString();
}

export function loadFromStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getLeague(xp) {
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (xp >= LEAGUES[i].minXP) return LEAGUES[i];
  }
  return LEAGUES[0];
}

export function getNextLeague(xp) {
  const current = getLeague(xp);
  const idx = LEAGUES.findIndex(l => l.id === current.id);
  if (idx < LEAGUES.length - 1) return LEAGUES[idx + 1];
  return null;
}

export function pickAdaptiveQuestion(pool, wrongCounts, mastery) {
  const weighted = pool.flatMap((q) => {
    const wrong = wrongCounts[q.key] || 0;
    const m = mastery[q.subjectId] ?? 0;
    const weight = 1 + wrong + (m < 60 ? 2 : 0);
    return Array.from({ length: weight }, () => q);
  });
  return weighted[Math.floor(Math.random() * weighted.length)];
}

export async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "API request failed");
  return data;
}

export async function syncUserDataToBackend(token, data) {
  if (!token) return;
  try {
    await api("/user-data/sync", {
      token,
      method: "POST",
      body: {
        stats: data.progress,
        mastery: data.progress?.mastery,
        wrongCounts: data.progress?.wrongCounts,
        srData: data.progress?.srData,
        lastStudied: data.progress?.lastStudied,
        timetable: data.timetable,
        notes: data.notes,
        outlineProgress: data.outlineProgress,
      },
    });
  } catch (e) {
    console.error("Failed to sync to backend:", e);
  }
}

export async function loadUserDataFromBackend(token) {
  if (!token) return null;
  try {
    const data = await api("/user-data", { token });
    return data;
  } catch (e) {
    console.error("Failed to load from backend:", e);
    return null;
  }
}
