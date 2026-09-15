import { API_BASE } from '../../lib/constants';

// Bridge between the Streak Survival UI and the app's server-side FSRS-6.
// The prototype's embedded FSRS-4.5 engine is intentionally absent — every
// answer POSTs a derived grade to /fsrs/rate, and per-question state comes
// from /fsrs/status/:resourceId.

export function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem('scholars-circle-auth') || '{}');
    return {
      Authorization: `Bearer ${authData.authToken}`,
      'Content-Type': 'application/json',
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}

export function isAuthed() {
  try {
    const authData = JSON.parse(localStorage.getItem('scholars-circle-auth') || '{}');
    return Boolean(authData.authToken);
  } catch {
    return false;
  }
}

// Exact prototype rating derivation:
// wrong / revealed → Again(1); hint used → Hard(2);
// ≤7s → Easy(4); ≥20s → Hard(2); else → Good(3).
export function deriveRating({ correct, revealed, hintUsed, elapsedMs }) {
  if (!correct || revealed) return 1;
  if (hintUsed) return 2;
  if (elapsedMs <= 7000) return 4;
  if (elapsedMs >= 20000) return 2;
  return 3;
}

// ── Question normalization ──────────────────────────────
// App mcqData shape: { question, options: {A..D}, correct: "A", explanation }
// Prototype shape:   { q, opts: [], a: idx, hint }
export function normalizeQuestion(mcq, idx = 0, resourceId = null, itemType = 'mcq') {
  const optsObj = mcq.options || {};
  const keys = Object.keys(optsObj).sort();
  const opts = keys.map((k) => optsObj[k]);
  const a = Math.max(0, keys.indexOf(mcq.correct));
  return {
    q: mcq.question || mcq.q || '',
    opts,
    a,
    hint: mcq.hint || '',
    explanation: mcq.explanation || '',
    _key: resourceId != null ? `${resourceId}:${idx}` : String(idx),
    _resourceId: resourceId,
    _pageIndex: idx,
    _itemType: itemType,
  };
}

export function normalizeBank(mcqData, resourceId) {
  const arr = typeof mcqData === 'string' ? JSON.parse(mcqData) : mcqData;
  if (!Array.isArray(arr)) return [];
  return arr.map((m, i) => normalizeQuestion(m, i, resourceId));
}

// ── Server calls ────────────────────────────────────────

export async function initFsrs(resourceId) {
  if (!isAuthed() || !resourceId) return;
  try {
    await fetch(`${API_BASE}/api/resources/fsrs/init`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ resourceId }),
    });
  } catch { /* offline / guest — FSRS features degrade silently */ }
}

// Returns { [pageIndex]: { state, stability, difficulty, dueAt, isDue, isMastered } }
export async function fetchCardStates(resourceId) {
  if (!isAuthed() || !resourceId) return {};
  try {
    const res = await fetch(`${API_BASE}/api/resources/fsrs/status/${resourceId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) return {};
    const data = await res.json();
    const map = {};
    for (const m of data.mcqs || []) {
      map[m.pageIndex] = {
        state: m.state,
        stability: m.stability,
        difficulty: m.difficulty,
        dueAt: m.dueAt,
        isDue: m.isDue,
        isMastered: m.isMastered,
        itemType: m.itemType,
      };
    }
    return map;
  } catch {
    return {};
  }
}

// POST a grade for an MCQ item. Returns the server response or null.
export async function rateQuestion({ resourceId, pageIndex, grade, topic, subject, itemType = 'mcq' }) {
  if (!isAuthed() || resourceId == null || pageIndex == null) return null;
  try {
    const res = await fetch(`${API_BASE}/api/resources/fsrs/rate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        resourceId,
        itemType,
        pageIndex,
        flashcardId: 'none',
        grade,
        topic,
        subject,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Let dashboard/stats surfaces refresh live; callers that have an
    // onXpUpdate prop handle XP themselves to avoid double counting.
    try {
      window.dispatchEvent(new CustomEvent('sc-fsrs-rated'));
      if (data.xpAwarded > 0) {
        window.dispatchEvent(new CustomEvent('sc-fsrs-xp', { detail: { xp: data.xpAwarded } }));
      }
    } catch { /* non-browser env */ }
    return data;
  } catch {
    return null;
  }
}

// ── Practice picking (exact prototype weights) ─────────
// due → 12, unseen → 5, else → max(0.3, 4/(1+S/8))
export function pickPracticeIndex(bank, cardStates, lastIdx) {
  const weights = bank.map((_, i) => {
    if (i === lastIdx) return 0.01;
    const st = cardStates[i];
    if (!st) return 5;
    if (st.isDue) return 12;
    return Math.max(0.3, 4 / (1 + (st.stability || 0) / 8));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return bank.length - 1;
}

// ── Mastery ring data ──────────────────────────────────
// mastered (S ≥ 21d) → 🌟, else dots (S ≥ 7d → 2, else 1); due → ⏰
export function masteryDots(cardState) {
  if (!cardState) return { dots: 0, mastered: false, due: false };
  const s = cardState.stability || 0;
  return {
    dots: cardState.isMastered || s >= 21 ? 3 : s >= 7 ? 2 : cardState.state > 0 ? 1 : 0,
    mastered: cardState.isMastered || s >= 21,
    due: Boolean(cardState.isDue),
  };
}

// ── 7-day forecast from card states ────────────────────
export function buildForecast(cardStates) {
  const days = Array(7).fill(0);
  const now = Date.now();
  for (const st of Object.values(cardStates)) {
    if (!st?.dueAt) continue;
    const diffDays = Math.floor((new Date(st.dueAt).getTime() - now) / 864e5);
    if (diffDays < 0) days[0] += 1; // overdue counts as today
    else if (diffDays < 7) days[diffDays] += 1;
  }
  return days;
}
