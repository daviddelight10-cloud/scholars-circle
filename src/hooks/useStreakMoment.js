import { useCallback, useEffect, useRef, useState } from "react";
import { localDayKey } from "../lib/dayKey.js";

// Once-a-day streak moment: decides what the daily open did to the user's
// streak and exposes a `moment` payload for the StreakMoment sheet.
//
// Baseline (`sc_streak_seen::<uid>`) holds the streak values the user last
// SAW — { day, streak, longest, freezes, level }. Comparing against the
// fresh server values reveals the transition: extended / freeze used /
// broken / milestone. The server also reports the transition directly via
// GET /user-data's streakInfo (cached to `sc_streak_info` by appUtils) —
// we prefer it when fresh because it's authoritative.

export const STREAK_MILESTONES = new Set([7, 14, 30, 50, 100, 200, 365]);
const WAIT_MS = 4000; // show the greeting even if /user-data is slow
const INFO_FRESH_MS = 90000; // streakInfo written this boot, not yesterday's

const sessionShown = new Set(); // dead-storage fallback: once per app session

function readBaseline(uid) {
  try {
    const raw = localStorage.getItem(`sc_streak_seen::${uid}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function writeBaseline(uid, state) {
  try { localStorage.setItem(`sc_streak_seen::${uid}`, JSON.stringify(state)); } catch {}
}

function readStreakInfo() {
  try {
    const raw = JSON.parse(localStorage.getItem("sc_streak_info") || "null");
    if (raw?.info && Date.now() - (raw.ts || 0) < INFO_FRESH_MS) return raw.info;
    return null;
  } catch { return null; }
}

/**
 * Pure derivation — unit-tested in src/lib/__tests__/streakMoment.test.js.
 * @param {object|null} prev  baseline {day, streak, freezes, level}
 * @param {object|null} cur   fresh values {streak, longestStreak, freezes}
 * @param {string} today      local YYYY-MM-DD
 * @returns {null | {state: string, prevStreak?: number, levelUp?: boolean}}
 */
export function deriveStreakMoment(prev, cur, today) {
  if (cur == null || typeof cur.streak !== "number") return null;
  if (prev?.day === today) return null; // already counted for today

  const levelUp = typeof prev?.level === "number" && typeof cur.level === "number" && cur.level > prev.level;

  if (!prev) return { state: "day1", levelUp };
  if (prev.streak > 1 && cur.streak === 1) return { state: "broken", prevStreak: prev.streak, levelUp };
  if (typeof prev.freezes === "number" && cur.freezes < prev.freezes) return { state: "freeze", levelUp };
  if (STREAK_MILESTONES.has(cur.streak) && cur.streak > (prev.streak || 0)) return { state: "milestone", levelUp };
  if (cur.streak > (prev.streak || 0)) return { state: "extended", levelUp };
  // Streak unchanged across a day boundary — happens when another device or
  // an earlier request already touched today, or when offline. The number is
  // real; we just can't claim it grew.
  if (cur.streak > 0) return { state: "streak", levelUp };
  return null; // brand-new account with streak 0 — FirstRun hero covers them
}

export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Last 7 local days ending today. A day tile is "lit" when it falls inside
 * the streak window (the last `streak` days). Unit-tested with derive.
 * @returns {Array<{key: string, letter: string, lit: boolean, today: boolean}>}
 */
export function weekStrip(streak, today = new Date()) {
  const n = Math.max(0, streak || 0);
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    out.push({
      key: localDayKey(d),
      letter: DAY_LETTERS[d.getDay()],
      lit: i < n,
      today: i === 0,
    });
  }
  return out;
}

/**
 * Grid cells for a "YYYY-MM" month: leading blanks (Sunday-first week) then
 * {key, day} per date. Pure — pairs with server streak-calendar data.
 */
export function monthCells(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const dim = new Date(y, m, 0).getDate();
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push({ key: `${monthKey}-${String(d).padStart(2, "0")}`, day: d });
  return cells;
}

/** Move a "YYYY-MM" key by whole months. */
export function shiftMonth(monthKey, delta) {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * @param {object} opts
 * @param {string} opts.userId
 * @param {number|undefined} opts.streak        fallback current streak (stats prop)
 * @param {number|undefined} opts.longestStreak fallback longest
 * @param {number|undefined} opts.freezes       fallback freeze count
 * @param {number} opts.level                   survival level (levelup flag)
 * @param {boolean} opts.enabled                false while onboarding is
 *   unresolved/showing — the gate stays CLOSED (no baseline write) so the
 *   once-a-day moment still fires once onboarding is done.
 * @returns {{ moment: object|null, dismiss: () => void }}
 */
export function useStreakMoment({ userId, streak, longestStreak, freezes, level, enabled = true }) {
  const [moment, setMoment] = useState(null);
  const [ready, setReady] = useState(false);
  const decidedRef = useRef(false);

  // Cap the wait for fresh server streakInfo — offline/slow boots still get
  // the sheet, derived from the last known stats.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!enabled) return; // gate closed — do NOT write the baseline yet
    if (decidedRef.current) return;
    const uid = userId || "guest";
    const today = localDayKey();
    const prev = readBaseline(uid);
    if (prev?.day === today || sessionShown.has(uid)) return;

    const info = readStreakInfo();
    let cur;
    if (info) {
      cur = { streak: info.streak, longestStreak: info.longestStreak, freezes: info.freezes, level };
    } else if (!ready && navigator.onLine !== false) {
      return; // keep waiting for the fresh info (or the timeout)
    } else if (typeof streak === "number") {
      cur = { streak, longestStreak, freezes, level };
    } else {
      return; // nothing at all yet — FirstRun hero handles new users
    }

    decidedRef.current = true;
    sessionShown.add(uid);
    const derived = deriveStreakMoment(prev, cur, today);
    writeBaseline(uid, {
      day: today,
      streak: cur.streak ?? 0,
      longest: cur.longestStreak ?? 0,
      freezes: cur.freezes ?? 0,
      level: cur.level ?? level ?? 1,
    });
    if (!derived) return;
    // Small delay so the sheet doesn't fight whatever surface is already
    // animating in (onboarding closing, tab switches, app boot).
    const t = setTimeout(() => setMoment({
      ...derived,
      streak: cur.streak,
      longestStreak: cur.longestStreak ?? cur.streak,
      freezes: cur.freezes ?? 0,
      offline: !info,
    }), 650);
    return () => clearTimeout(t);
  }, [enabled, ready, userId, streak, longestStreak, freezes, level]);

  const dismiss = useCallback(() => setMoment(null), []);

  return { moment, dismiss };
}
