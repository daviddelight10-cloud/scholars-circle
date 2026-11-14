import { describe, it, expect } from "vitest";
import { fmtDeadline, fmtDuration, challengeUrl, canTakeChallenge } from "./challengeUtils";

const now = new Date("2026-01-10T12:00:00Z");

describe("fmtDeadline", () => {
  it("returns null with no deadline", () => {
    expect(fmtDeadline(null, now)).toBeNull();
    expect(fmtDeadline(undefined, now)).toBeNull();
  });

  it("reports days for long deadlines", () => {
    expect(fmtDeadline("2026-01-13T12:00:00Z", now)).toBe("3d left");
    expect(fmtDeadline("2026-01-12T13:00:00Z", now)).toBe("2d left");
  });

  it("reports hours+minutes under 48h", () => {
    expect(fmtDeadline("2026-01-10T15:30:00Z", now)).toBe("3h 30m left");
  });

  it("reports minutes under 1h, minimum 1m", () => {
    expect(fmtDeadline("2026-01-10T12:45:00Z", now)).toBe("45m left");
    expect(fmtDeadline("2026-01-10T12:00:20Z", now)).toBe("1m left");
  });

  it("reports Ended for past deadlines", () => {
    expect(fmtDeadline("2026-01-10T11:59:00Z", now)).toBe("Ended");
    expect(fmtDeadline("2026-01-10T12:00:00Z", now)).toBe("Ended");
  });
});

describe("fmtDuration", () => {
  it("formats seconds and minutes", () => {
    expect(fmtDuration(42000)).toBe("42s");
    expect(fmtDuration(185000)).toBe("3m 5s");
    expect(fmtDuration(0)).toBe("0s");
  });

  it("returns a dash for missing values", () => {
    expect(fmtDuration(null)).toBe("—");
    expect(fmtDuration(undefined)).toBe("—");
  });
});

describe("challengeUrl", () => {
  it("builds an /exam/<token> URL", () => {
    expect(challengeUrl("abc123", "https://scholars.app")).toBe("https://scholars.app/exam/abc123");
  });
});

describe("canTakeChallenge", () => {
  const base = { closed: false, scoring: "first", mine: null };

  it("allows a fresh taker on an open challenge", () => {
    expect(canTakeChallenge(base)).toBe(true);
  });

  it("blocks when the challenge is closed", () => {
    expect(canTakeChallenge({ ...base, closed: true })).toBe(false);
  });

  it("blocks a retake under first-attempt scoring", () => {
    expect(canTakeChallenge({ ...base, mine: { attempts: 1, bestPct: 70 } })).toBe(false);
  });

  it("allows a retake under best scoring", () => {
    expect(canTakeChallenge({ ...base, scoring: "best", mine: { attempts: 1, bestPct: 70 } })).toBe(true);
  });
});
