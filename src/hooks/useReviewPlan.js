import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../lib/constants";
import { fetchWithAuth } from "../lib/authToken.js";

const FOLDERS_KEY = "sc_fsrs_folders";
const PREFS_KEY = "sc_exam_prefs";

function readCache(key) {
  try { return JSON.parse(localStorage.getItem(key) || "null")?.data ?? null; } catch { return null; }
}
function writeCache(key, data) {
  try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
}

// Exam dates are stored per course code. Folders without one fall back to a
// folder-scoped key so every folder can still carry a date.
export const examKeyOf = (f) => f?.courseCode || `folder:${f?.key}`;

const pad = (n) => (n < 10 ? "0" : "") + n;
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
export function daysUntil(iso) {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - t) / 864e5);
}
export const readiness = (f) => (f?.total ? Math.round(((f.mastered + f.learning * 0.5) / f.total) * 100) : 0);
export const needPerDay = (f, days) => Math.ceil(((f?.due || 0) + (f?.learning || 0)) / Math.max(days, 1));

/**
 * Per-folder review summary + exam dates for the Home review card.
 * Cache-first: paints from localStorage immediately, then refreshes.
 * `failed` lets the card fall back to plain stats if the endpoint is down.
 */
export function useReviewPlan() {
  const [folders, setFolders] = useState(() => readCache(FOLDERS_KEY));
  const [prefs, setPrefs] = useState(() => readCache(PREFS_KEY) || {});
  const [failed, setFailed] = useState(false);

  const loadFolders = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/resources/fsrs/folders`);
      if (!res.ok) throw new Error();
      const data = (await res.json()).folders || [];
      setFolders(data);
      setFailed(false);
      writeCache(FOLDERS_KEY, data);
    } catch { setFailed(true); }
  }, []);

  const loadPrefs = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/curriculum/prefs`);
      if (!res.ok) return;
      const map = {};
      for (const p of (await res.json()).prefs || []) if (p.examDate) map[p.courseCode] = String(p.examDate).slice(0, 10);
      setPrefs(map);
      writeCache(PREFS_KEY, map);
    } catch {}
  }, []);

  useEffect(() => {
    loadFolders();
    loadPrefs();
    window.addEventListener("sc-fsrs-rated", loadFolders);
    return () => window.removeEventListener("sc-fsrs-rated", loadFolders);
  }, [loadFolders, loadPrefs]);

  // Optimistic save; rolls back and returns false if the server rejects it.
  const setExam = useCallback(async (code, iso) => {
    let prev;
    setPrefs((p) => {
      prev = p;
      const next = { ...p };
      if (iso) next[code] = iso; else delete next[code];
      writeCache(PREFS_KEY, next);
      return next;
    });
    try {
      const res = await fetchWithAuth(`${API_BASE}/api/curriculum/${encodeURIComponent(code)}/prefs`, {
        method: "PATCH",
        body: JSON.stringify({ examDate: iso || null }),
      });
      if (!res.ok) throw new Error();
      return true;
    } catch {
      setPrefs(prev || {});
      writeCache(PREFS_KEY, prev || {});
      return false;
    }
  }, []);

  return { folders, prefs, failed, setExam, reload: loadFolders };
}
