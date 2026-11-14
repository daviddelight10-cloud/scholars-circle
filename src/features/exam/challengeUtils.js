// Shared display helpers for exam challenges (landing page, ExamHub strip,
// group Play cards). Pure functions so they're unit-testable.

/** "3h 20m left" | "2d left" | "Ended" | null when there's no deadline. */
export function fmtDeadline(deadline, now = new Date()) {
  if (!deadline) return null;
  const ms = new Date(deadline) - now;
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}

/** "42s" | "3m 5s" | "—" */
export function fmtDuration(ms) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

/** Absolute origin-qualified share URL for a challenge token. */
export function challengeUrl(token, origin = (typeof window !== "undefined" ? window.location.origin : "")) {
  return `${origin}/exam/${token}`;
}

/** Can the current user still enter the runner for this challenge meta? */
export function canTakeChallenge(meta, mine = meta?.mine) {
  if (!meta || meta.closed) return false;
  if (meta.scoring === "first" && mine) return false; // first attempt already used
  return true;
}
