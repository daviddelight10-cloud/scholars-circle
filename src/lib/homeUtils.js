// Home-screen helpers: recent docs rail ("Jump back in") + weak-subject pick.

const RECENTS_KEY = "sc_recent_docs";
const MAX_RECENTS = 12;

/**
 * Record a resource open for the Home "Jump back in" rail.
 * Called from ResourceViewer once a resource loads.
 */
export function recordRecentDoc(resource) {
  if (!resource) return;
  const shareToken = resource.shareToken;
  if (!shareToken || !resource.title) return;
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const next = [
      {
        shareToken,
        resourceId: resource.id || null,
        title: resource.title,
        subject: resource.subject || null,
        contentType: resource.contentType || "pdf",
        fileUrl: resource.fileUrl || null,
        ts: Date.now(),
      },
      ...list.filter((d) => d.shareToken !== shareToken),
    ].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    try { window.dispatchEvent(new CustomEvent("sc-recent-doc")); } catch {}
  } catch {}
}

/** Most-recent-first list of opened docs for the rail. */
export function listRecentDocs() {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Subjects with the highest lapse rates from fsrsAnalytics.lapseBySubject
 * ({ subject: { total, lapsed } }) — the "needs work" list.
 */
export function lapsedSubjects(fsrsAnalytics, limit = 3) {
  const map = fsrsAnalytics?.lapseBySubject;
  if (!map) return [];
  return Object.entries(map)
    .filter(([, s]) => (s?.total || 0) >= 3 && (s?.lapsed || 0) > 0)
    .map(([name, s]) => ({ name, rate: Math.round((s.lapsed / s.total) * 100) }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, limit);
}

/**
 * Pick the user's weakest subject from fsrsStats.bySubject —
 * lowest mastered ratio among subjects that have items.
 */
export function weakestSubject(fsrsStats) {
  const bySubject = fsrsStats?.bySubject;
  if (!bySubject) return null;
  let worst = null;
  let worstRatio = Infinity;
  for (const [name, s] of Object.entries(bySubject)) {
    const total = s?.total || 0;
    if (total < 3) continue; // ignore noise
    const ratio = (s.mastered || 0) / total;
    if (ratio < worstRatio) { worstRatio = ratio; worst = name; }
  }
  return worst;
}
