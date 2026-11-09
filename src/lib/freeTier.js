// Free-tier state: 2-day full-access trial → permanent free tier with caps.
// Persisted per user under `sc_freetier::<uid>` so any component can check
// status without prop drilling. Activation status is read from the persisted
// `scholars-circle-auth` blob (authUser.isActivated).

import { FREE_TIER_LIMITS } from "./constants";
import { localDayKey } from "./dayKey.js";

const STORE_PREFIX = "sc_freetier::";

export function getUid() {
  try {
    const authRaw = localStorage.getItem("scholars-circle-auth");
    if (authRaw) {
      const authParsed = JSON.parse(authRaw);
      return authParsed.authUser?.id || authParsed.authUser?.username || "guest";
    }
  } catch { /* ignore */ }
  return localStorage.getItem("scholars-circle-current-user") || "guest";
}

function defaults() {
  return {
    active: false,            // user opted into the free experience
    trialStartDate: null,     // epoch ms — set on first activation
    summaries: 0,             // lifetime AI summaries generated
    mcqGens: 0,               // lifetime Practice Questions generations
    guidedStudies: 0,         // lifetime guided study sessions
    aiMsgsDate: "",           // AI Tutor daily counter
    aiMsgs: 0,
    heartsLost: 0,            // survival hearts lost toward the cooldown threshold
    heartsDate: "",           // local day the losses belong to — pool resets daily
    cooldownUntil: 0,         // epoch ms — survival sessions blocked until then
    trialEndNotified: false,  // one-time "trial ended" modal shown
    wasActivated: false,      // user has held a paid/activated plan before
  };
}

let cache = null;
let cacheUid = null;

export function loadState() {
  const uid = getUid();
  if (cache && cacheUid === uid) return cache;
  cacheUid = uid;
  try {
    const raw = localStorage.getItem(STORE_PREFIX + uid);
    cache = raw ? { ...defaults(), ...JSON.parse(raw) } : defaults();
  } catch {
    cache = defaults();
  }
  migrateLegacy(cache);
  return cache;
}

function persist() {
  if (!cache) return;
  try { localStorage.setItem(STORE_PREFIX + cacheUid, JSON.stringify(cache)); } catch { /* quota */ }
}

export function mutate(fn) {
  const s = loadState();
  fn(s);
  persist();
  return s;
}

// One-time migration from the legacy per-user state blob (`demoMode`,
// `demoUsage.trialStartDate`, `demoUsage.aiTutorMessages`).
function migrateLegacy(state) {
  if (state._migrated) return;
  state._migrated = true;
  try {
    const raw = localStorage.getItem(`scholars-circle-state::${getUid()}`);
    if (!raw) return;
    const legacy = JSON.parse(raw);
    if (legacy.demoMode && !state.active) state.active = true;
    const lu = legacy.demoUsage || {};
    if (lu.trialStartDate && !state.trialStartDate) state.trialStartDate = lu.trialStartDate;
    if ((lu.aiTutorMessages || 0) > state.aiMsgs) {
      state.aiMsgs = lu.aiTutorMessages;
      state.aiMsgsDate = lu.aiTutorDate || "";
    }
  } catch { /* ignore */ }
}

// ---------- Status ----------

export function isActivatedUser() {
  try {
    const authRaw = localStorage.getItem("scholars-circle-auth");
    if (!authRaw) return false;
    const user = JSON.parse(authRaw).authUser;
    const role = String(user?.role || "").toUpperCase();
    return user?.isActivated === true || role === "TEACHER" || role === "LECTURER" || role === "ADMIN";
  } catch {
    return false;
  }
}

// Custom practice sets (count, clinical style, difficulty, focus) are a
// paid feature — the free trial does not unlock them.
export function canCustomiseMcq() {
  return isActivatedUser();
}

// True when the auth blob proves this account once held an activated plan
// (`activatedAt`/`activationExpiry` survive deactivation — only isActivated
// and planType are cleared). A lapsed subscriber never gets a trial.
export function everActivated() {
  try {
    const authRaw = localStorage.getItem("scholars-circle-auth");
    if (!authRaw) return false;
    const u = JSON.parse(authRaw).authUser;
    return !!(u?.activatedAt || u?.activationExpiry);
  } catch {
    return false;
  }
}

// Called when the auth refresh detects activation being revoked (plan expiry
// or admin deactivation). Permanently marks the account as ex-paid so the
// free tier skips the trial — even if the trial was never used.
export function noteDeactivated() {
  mutate((s) => { s.wasActivated = true; s.trialEndNotified = true; });
}

// True when the user is on the free experience (opted in, not activated).
export function isFreeTier() {
  return loadState().active === true && !isActivatedUser();
}

// 'trial' (first FREE_TIER_LIMITS.trialDays days) → 'free' (capped forever).
// null when the user isn't on the free tier at all.
export function freeTierPhase() {
  if (!isFreeTier()) return null;
  const s = loadState();
  // Ex-paid accounts land straight on the capped free tier — no fresh trial,
  // no leftover trial days once a plan has been held.
  if (s.wasActivated || everActivated()) return "free";
  if (!s.trialStartDate) return "trial";
  const elapsedDays = (Date.now() - s.trialStartDate) / 86400000;
  return elapsedDays < FREE_TIER_LIMITS.trialDays ? "trial" : "free";
}

export function trialDaysLeft() {
  const s = loadState();
  if (!s.trialStartDate) return FREE_TIER_LIMITS.trialDays;
  return Math.max(0, Math.ceil(FREE_TIER_LIMITS.trialDays - (Date.now() - s.trialStartDate) / 86400000));
}

// Trial ended but the "trial ended" modal hasn't been shown yet.
export function trialEndPending() {
  const s = loadState();
  return freeTierPhase() === "free" && !s.trialEndNotified;
}

export function markTrialEndNotified() {
  mutate((s) => { s.trialEndNotified = true; });
}

// ---------- Enter / exit ----------

export function enterFreeTier() {
  return mutate((s) => {
    s.active = true;
    if (s.wasActivated || everActivated()) s.trialEndNotified = true; // no "trial ended" modal for ex-paid
    if (!s.trialStartDate) s.trialStartDate = Date.now();
  });
}

export function exitFreeTier() {
  return mutate((s) => { s.active = false; });
}

// ---------- Feature caps ----------
// Feature keys: "summary" | "mcqGen" | "guidedStudy" | "aiTutor" |
//               "exam" | "voiceTutor" (premium-only post-trial)

const CAPS = {
  summary: "summariesTotal",
  mcqGen: "mcqGensTotal",
  guidedStudy: "guidedStudiesTotal",
  aiTutor: "aiTutorDaily",
};

const PREMIUM_ONLY = new Set(["exam", "voiceTutor"]);

function usageKeyFor(feature) {
  return { summary: "summaries", mcqGen: "mcqGens", guidedStudy: "guidedStudies" }[feature];
}

export function canUse(feature) {
  const phase = freeTierPhase();
  if (phase === null) return true;      // paid / not in free experience
  if (phase === "trial") return true;   // everything unlocked during trial
  if (PREMIUM_ONLY.has(feature)) return false;

  const s = loadState();
  if (feature === "aiTutor") {
    const today = new Date().toDateString();
    const used = s.aiMsgsDate === today ? s.aiMsgs : 0;
    return used < FREE_TIER_LIMITS.aiTutorDaily;
  }
  const key = usageKeyFor(feature);
  if (!key) return true;
  return (s[key] || 0) < FREE_TIER_LIMITS[CAPS[feature]];
}

// Record one use of a capped feature. Call after a successful action.
export function consume(feature) {
  const s = mutate((st) => {
    if (feature === "aiTutor") {
      const today = new Date().toDateString();
      if (st.aiMsgsDate !== today) { st.aiMsgsDate = today; st.aiMsgs = 0; }
      st.aiMsgs += 1;
      return;
    }
    const key = usageKeyFor(feature);
    if (key) st[key] = (st[key] || 0) + 1;
  });
  return s;
}

export function usageRemaining(feature) {
  const s = loadState();
  if (feature === "aiTutor") {
    const today = new Date().toDateString();
    const used = s.aiMsgsDate === today ? s.aiMsgs : 0;
    return Math.max(0, FREE_TIER_LIMITS.aiTutorDaily - used);
  }
  const key = usageKeyFor(feature);
  if (!key || !CAPS[feature]) return Infinity;
  return Math.max(0, FREE_TIER_LIMITS[CAPS[feature]] - (s[key] || 0));
}

// ---------- Survival hearts cooldown ----------
// Free-tier users: after losing `survivalHeartsBeforeCooldown` hearts, all new
// practice/survival sessions are blocked for `survivalCooldownMinutes`. The
// heart counter resets once the cooldown expires.

export function survivalCooldownRemaining() {
  if (freeTierPhase() !== "free") return 0;
  return Math.max(0, (loadState().cooldownUntil || 0) - Date.now());
}

export function isSurvivalCoolingDown() {
  return survivalCooldownRemaining() > 0;
}

// Free-tier heart pool: `survivalHeartsBeforeCooldown` hearts that persist
// ACROSS sessions (quitting at 4 hearts → next session starts at 4). The pool
// refills when the cooldown ends, and always resets to full on a new local
// day — yesterday's losses never carry into today.
export function freeHeartsLeft() {
  if (freeTierPhase() !== "free") return Infinity;
  const s = loadState();
  if ((s.cooldownUntil || 0) > Date.now()) return 0;
  const today = localDayKey();
  const lost = s.heartsDate === today ? (s.heartsLost || 0) : 0;
  return Math.max(0, FREE_TIER_LIMITS.survivalHeartsBeforeCooldown - lost);
}

// Called from loseLife() — returns true when this heart loss triggered a cooldown.
// Hearts drain the persistent cross-session pool, so a free user can't dodge
// the wall by quitting before a second death.
export function recordSurvivalHeartLoss() {
  if (freeTierPhase() !== "free") return false;
  let triggered = false;
  mutate((s) => {
    const today = localDayKey();
    if (s.heartsDate !== today) { s.heartsDate = today; s.heartsLost = 0; }
    if (s.cooldownUntil > Date.now()) return; // already cooling down
    s.heartsLost = (s.heartsLost || 0) + 1;
    if (s.heartsLost >= FREE_TIER_LIMITS.survivalHeartsBeforeCooldown) {
      s.cooldownUntil = Date.now() + FREE_TIER_LIMITS.survivalCooldownMinutes * 60000;
      s.heartsLost = 0;
      triggered = true;
    }
  });
  return triggered;
}

// Called when a free-tier survival run ends in a second death (3 hearts plus
// the one refill already spent). Starts the recharge immediately so the
// premium wall can show a live countdown. Returns remaining ms (0 for
// trial/paid or when already cooling down).
export function triggerSurvivalCooldown() {
  if (freeTierPhase() !== "free") return 0;
  mutate((s) => {
    if (s.cooldownUntil > Date.now()) return; // already cooling down
    s.cooldownUntil = Date.now() + FREE_TIER_LIMITS.survivalCooldownMinutes * 60000;
    s.heartsLost = 0;
    s.heartsDate = localDayKey();
  });
  return survivalCooldownRemaining();
}

// The one free refill (or a mid-run earned heart) puts a heart back into the
// pool — same-day only, capped at the pool maximum.
export function restoreSurvivalHeart() {
  if (freeTierPhase() !== "free") return;
  mutate((s) => {
    const today = localDayKey();
    if (s.heartsDate !== today) { s.heartsDate = today; s.heartsLost = 0; }
    s.heartsLost = Math.max(0, (s.heartsLost || 0) - 1);
  });
}
