// Rank watch — detects when the user climbs the (tier-scoped) leaderboard.
// Cheap: GET /api/leaderboard?limit=1 returns myRank without loading entries.
// Called at "checkpoint" moments (chapter review finish, exam submit), not
// per-answer — keeps traffic low and makes each celebration meaningful.
import { API_BASE } from "./constants";

const LS_KEY = "sc:lb-rank";

function headers() {
  try {
    const a = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return a.authToken ? { Authorization: `Bearer ${a.authToken}` } : {};
  } catch { return {}; }
}

export async function checkRankJump() {
  try {
    const res = await fetch(`${API_BASE}/api/leaderboard?limit=1`, { headers: headers() });
    if (!res.ok) return null;
    const data = await res.json();
    const rank = data.myRank;
    if (!rank) return null;
    const tier = data.league?.tier || null;
    const prev = parseInt(localStorage.getItem(LS_KEY) || "0", 10);
    localStorage.setItem(LS_KEY, String(rank));
    // First-ever check stores the baseline — celebrate only real climbs.
    if (prev && rank < prev) return { from: prev, to: rank, passed: prev - rank, tier };
    return null;
  } catch {
    return null;
  }
}
