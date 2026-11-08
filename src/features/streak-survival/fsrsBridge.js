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
// flip-card self-grade ("knew it") → Good(3) — unverifiable, never Easy;
// typing gets relaxed windows since typing latency isn't slow recall:
//   mcq ≤7s / type ≤15s → Easy(4); mcq ≥20s / type ≥40s → Hard(2); else Good(3).
// Thresholds scale with reading time (budgetMs, default 7s = unchanged) so a
// long clinical vignette isn't graded Hard just because it takes time to read.
export function deriveRating({ correct, revealed, hintUsed, elapsedMs, via, budgetMs = READ_FLOOR_MS }) {
  if (!correct || revealed) return 1;
  if (hintUsed) return 2;
  if (via === 'card') return 3;
  const scale = Math.max(1, budgetMs / READ_FLOOR_MS);
  const easyMs = (via === 'type' ? 15000 : 7000) * scale;
  const hardMs = (via === 'type' ? 40000 : 20000) * scale;
  if (elapsedMs <= easyMs) return 4;
  if (elapsedMs >= hardMs) return 2;
  return 3;
}

export const READ_FLOOR_MS = 7000;

// Time a student reasonably needs to read a question and its options.
// Short MCQs stay at the 7s floor; a 150-word vignette gets ~24s.
export function readingBudgetMs(q) {
  const text = `${q?.q || ''} ${(q?.opts || []).join(' ')}`.trim();
  const words = text ? text.split(/\s+/).length : 0;
  return Math.max(READ_FLOOR_MS, 1500 + words * 150);
}

export function isVignette(q) {
  return q?._qType === 'vignette' || (q?.q || '').length > 350;
}

const normTopic = (t) => {
  const s = String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return s.length > 4 ? s.replace(/s$/, '') : s;
};

// Group questions by topic. statesByKey is keyed by question _key.
// Returns [{ key, topic, total, mastered, due, pct }] weakest first.
export function topicStats(bank, statesByKey = {}) {
  const map = new Map();
  for (const q of bank) {
    const key = normTopic(q._qTopic);
    if (!key) continue;
    let g = map.get(key);
    if (!g) { g = { key, topic: String(q._qTopic).trim(), total: 0, mastered: 0, due: 0 }; map.set(key, g); }
    g.total += 1;
    const st = statesByKey[q._key];
    if (st && (st.isMastered || (st.stability || 0) >= 21)) g.mastered += 1;
    if (st?.isDue) g.due += 1;
  }
  return [...map.values()]
    .map((g) => ({ ...g, pct: g.total ? Math.round((g.mastered / g.total) * 100) : 0 }))
    .sort((a, b) => a.pct - b.pct || b.due - a.due || b.total - a.total);
}

// Accuracy per topic for a finished run. history entries: { q, ok }.
export function tallyTopics(history) {
  const map = new Map();
  for (const h of history || []) {
    const key = normTopic(h.q?._qTopic);
    if (!key) continue;
    let g = map.get(key);
    if (!g) { g = { key, topic: String(h.q._qTopic).trim(), total: 0, correct: 0 }; map.set(key, g); }
    g.total += 1;
    if (h.ok) g.correct += 1;
  }
  return [...map.values()]
    .map((g) => ({ ...g, pct: Math.round((g.correct / g.total) * 100) }))
    .sort((a, b) => a.pct - b.pct || b.total - a.total);
}

export const topicKey = normTopic;

// Auto-sized study session (Gizmo-style): due cards first (most overdue /
// weakest first), then unseen, then weakest learning cards. Size adapts to
// what is due: 12 by default, up to 20 when a lot is due, never more than the
// pool. Returns bank indices in priority order.
export function buildSession(bank, statesByKey = {}, { topics = null, exclude = null } = {}) {
  const want = topics ? new Set(topics.map(normTopic)) : null;
  const rows = [];
  bank.forEach((q, i) => {
    if (exclude?.has(i)) return;
    if (want && !want.has(normTopic(q._qTopic))) return;
    const st = statesByKey[q._key];
    const unseen = !st || !st.state;
    const cat = st?.isDue ? 0 : unseen ? 1 : 2;
    const overdue = st?.dueAt ? new Date(st.dueAt).getTime() : 0;
    rows.push({ i, cat, s: st?.stability || 0, overdue });
  });
  rows.sort((a, b) => a.cat - b.cat || (a.cat === 0 ? a.overdue - b.overdue || a.s - b.s : a.s - b.s));
  const dueN = rows.filter((r) => r.cat === 0).length;
  let target = dueN >= 8 ? Math.min(dueN, 20) : 12;
  target = Math.min(target, rows.length);
  return { indices: rows.slice(0, target).map((r) => r.i), due: Math.min(dueN, target), poolSize: rows.length };
}

export const sessionMinutes = (n) => Math.max(1, Math.round((n * 22) / 60));

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
    // AI-generated metadata (separate from _topic, which Daily Review uses for the resource title)
    _qTopic: mcq.topic || null,
    _qDiff: ['easy', 'medium', 'hard'].includes(mcq.difficulty) ? mcq.difficulty : null,
    _qType: ['recall', 'applied', 'vignette'].includes(mcq.qtype || mcq.type) ? (mcq.qtype || mcq.type) : null,
    _key: resourceId != null ? `${resourceId}:${idx}` : String(idx),
    _resourceId: resourceId,
    _pageIndex: idx,
    _itemType: itemType,
    // Provenance for PDF-generated questions (set by /deck/add)
    _src: mcq._src || null,
    _srcTitle: mcq._srcTitle || null,
    _srcPage: mcq._srcPage || null,
    _srcToken: mcq._srcToken || null,
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
export function pickPracticeIndex(bank, cardStates, lastIdx, allowed = null) {
  const weights = bank.map((_, i) => {
    if (allowed && !allowed.has(i)) return 0;
    if (i === lastIdx) return 0.01;
    const st = cardStates[i];
    if (!st) return 5;
    if (st.isDue) return 12;
    return Math.max(0.3, 4 / (1 + (st.stability || 0) / 8));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return allowed?.values().next().value ?? 0;
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return bank.length - 1;
}

// ── Survival picking ──────────────────────────────────
// Uniform random at low streaks; as the streak climbs, blend toward
// FSRS weakness (due cards first, then low stability) so the pressure
// ramp is real difficulty, not just XP. `allowed` = unused bank indices.
export function pickSurvivalIndex(bank, cardStates, lastIdx, streak, allowed) {
  const intensity = Math.min(1, Math.max(0, streak) / 6);
  let total = 0;
  const weights = bank.map((_, i) => {
    if (!allowed.has(i) || i === lastIdx) return 0;
    const st = cardStates[i];
    const weak = !st ? 1.2 : st.isDue ? 5 : Math.max(0.4, 3 - (st.stability || 0) / 7);
    const w = 1 + weak * intensity * 2;
    total += w;
    return w;
  });
  if (total <= 0) return allowed.values().next().value ?? 0;
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
