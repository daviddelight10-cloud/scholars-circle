import { LEAGUES, API_BASE } from "./constants";
import { tzOffsetMinutes, localDayKey } from "./dayKey.js";
import { fetchWithAuth } from "./authToken.js";

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

/**
 * Validate a ?redirect= param so it can only point at a same-origin path.
 * Blocks "//host" protocol-relative URLs, "\", "@" tricks, and whitespace —
 * anything else falls back to /app. Use everywhere auth flows redirect.
 */
export function safeRedirect(param, fallback = "/app") {
  if (typeof param !== "string") return fallback;
  if (!param.startsWith("/") || param.startsWith("//")) return fallback;
  if (/[\s\\@]/.test(param)) return fallback;
  return param;
}

export async function api(path, { token, method = "GET", body } = {}) {  const res = await fetchWithAuth(`${API_BASE}${path}`, {
    token,
    method,
    // Dead-network guard: navigator.onLine lies on broken WiFi/captive
    // portals — without a timeout a fetch can hang ~2min at TCP level.
    ...(AbortSignal.timeout ? { signal: AbortSignal.timeout(15000) } : {}),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "API request failed");
  return data;
}

// Streak calendar — real per-day activity for the streak sheet's month grid.
// Past months cache forever (history can't change); the current month is
// always refetched so today's activity shows without a reload.
const streakCalCache = new Map(); // `${uid}::${month}` → Promise<payload|null>
export function fetchStreakCalendar(monthKey) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthKey || "")) return Promise.resolve(null);
  let uid = "anon";
  try { uid = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}")?.authUser?.id || "anon"; } catch {}
  const key = `${uid}::${monthKey}`;
  const current = monthKey === localDayKey().slice(0, 7);
  if (!current && streakCalCache.has(key)) return streakCalCache.get(key);
  const p = api(`/user-data/streak-calendar?month=${monthKey}&tz=${tzOffsetMinutes()}`)
    .then((d) => (d && Array.isArray(d.days) ? d : null))
    .catch(() => { streakCalCache.delete(key); return null; });
  if (!current) streakCalCache.set(key, p);
  return p;
}

export async function syncUserDataToBackend(token, data) {
  if (!token) return;
  try {
    await api("/user-data/sync", {
      token,
      method: "POST",
      body: {
        tzOffsetMinutes: tzOffsetMinutes(),
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
    // ?tz= reports the device's current offset so the server streak touch
    // uses the user's local day boundary (and stores it for next time).
    const data = await api(`/user-data?tz=${tzOffsetMinutes()}`, { token });
    // streakInfo powers the once-a-day streak moment on Home — cache it so
    // the sheet can derive its state even across remounts.
    if (data?.streakInfo) {
      try { localStorage.setItem("sc_streak_info", JSON.stringify({ info: data.streakInfo, ts: Date.now() })); } catch {}
    }
    return data;
  } catch (e) {
    console.error("Failed to load from backend:", e);
    return null;
  }
}
