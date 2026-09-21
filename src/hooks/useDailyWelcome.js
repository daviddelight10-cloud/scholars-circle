import { useCallback, useEffect, useRef, useState } from "react";

// Daily welcome sheet gating: at most once per calendar day per user, with
// message priority level-up > streak milestone > comeback > greeting.
// Storage shape: { shown: "YYYY-MM-DD", lastLevel: number }

const STREAK_MILESTONES = new Set([7, 14, 30, 50, 100, 200, 365]);
const COMEBACK_DAYS = 3;
const READY_TIMEOUT_MS = 4000;

// Local calendar day (not UTC) so "once a day" tracks the user's midnight.
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readState(uid) {
  try {
    const raw = localStorage.getItem(`sc_welcome_v1::${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeState(uid, state) {
  try {
    localStorage.setItem(`sc_welcome_v1::${uid}`, JSON.stringify(state));
  } catch { /* storage unavailable — session flag still caps at once per load */ }
}

// Fallback for dead localStorage: at most once per app session per user.
const sessionShown = new Set();

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {boolean} opts.dataReady - Home data (fsrsStats) has resolved at least once
 * @param {number} opts.streak
 * @param {number} opts.level
 * @param {number|null} opts.dueCount - null while unknown (never claim "0 due")
 * @param {string} opts.name
 * @param {number|null} opts.lastActiveDaysAgo
 * @returns {{ message: object|null, dismiss: () => void }}
 */
export function useDailyWelcome({ userId, dataReady, streak, level, dueCount, name, lastActiveDaysAgo }) {
  const [message, setMessage] = useState(null);
  const [ready, setReady] = useState(!!dataReady);
  const decidedRef = useRef(false);

  // Don't wait on the network forever — after the timeout show the greeting
  // without a due-count claim.
  useEffect(() => {
    if (dataReady) { setReady(true); return; }
    const t = setTimeout(() => setReady(true), READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [dataReady]);

  useEffect(() => {
    if (!ready || decidedRef.current) return;

    const uid = userId || "guest";
    const prev = readState(uid);
    if (prev?.shown === todayStr() || sessionShown.has(uid)) return;

    decidedRef.current = true;
    sessionShown.add(uid);
    // Persist eagerly on show so a remount/StrictMode pass can't double-show.
    writeState(uid, { shown: todayStr(), lastLevel: level });

    let kind = "greeting";
    if (typeof prev?.lastLevel === "number" && level > prev.lastLevel) kind = "levelup";
    else if (STREAK_MILESTONES.has(streak)) kind = "streak";
    else if (typeof lastActiveDaysAgo === "number" && lastActiveDaysAgo >= COMEBACK_DAYS) kind = "comeback";

    setMessage({ kind, name, streak, level, dueCount, daysAway: lastActiveDaysAgo });
  }, [ready, userId, streak, level, dueCount, name, lastActiveDaysAgo]);

  const dismiss = useCallback(() => setMessage(null), []);

  return { message, dismiss };
}
