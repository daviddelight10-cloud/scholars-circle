import { describe, it, expect } from "vitest";
import { deriveStreakMoment, weekStrip } from "../../hooks/useStreakMoment.js";

const prev = (over = {}) => ({
  day: "2026-02-20",
  streak: 11,
  longest: 15,
  freezes: 2,
  level: 4,
  ...over,
});
const cur = (over = {}) => ({
  streak: 12,
  longestStreak: 15,
  freezes: 2,
  level: 4,
  ...over,
});
const TODAY = "2026-02-21";

describe("deriveStreakMoment", () => {
  it("returns null without current data or for a same-day repeat", () => {
    expect(deriveStreakMoment(prev(), null, TODAY)).toBeNull();
    expect(deriveStreakMoment(prev({ day: TODAY }), cur(), TODAY)).toBeNull();
    expect(deriveStreakMoment(prev(), { streak: undefined }, TODAY)).toBeNull();
  });

  it("first-ever open → day1", () => {
    expect(deriveStreakMoment(null, cur({ streak: 1 }), TODAY)).toEqual({ state: "day1", levelUp: false });
  });

  it("streak grew by one → extended", () => {
    expect(deriveStreakMoment(prev(), cur(), TODAY).state).toBe("extended");
  });

  it("freeze count dropped but streak held → freeze", () => {
    const r = deriveStreakMoment(prev(), cur({ streak: 12, freezes: 1 }), TODAY);
    expect(r.state).toBe("freeze");
  });

  it("streak reset from >1 → broken with prevStreak", () => {
    const r = deriveStreakMoment(prev({ streak: 23 }), cur({ streak: 1 }), TODAY);
    expect(r).toMatchObject({ state: "broken", prevStreak: 23 });
  });

  it("milestone beats extended", () => {
    expect(deriveStreakMoment(prev({ streak: 6 }), cur({ streak: 7 }), TODAY).state).toBe("milestone");
    expect(deriveStreakMoment(prev({ streak: 8 }), cur({ streak: 9 }), TODAY).state).toBe("extended");
  });

  it("same streak across a day boundary → streak (touched elsewhere)", () => {
    expect(deriveStreakMoment(prev({ streak: 12 }), cur(), TODAY).state).toBe("streak");
  });

  it("streak 0 with no history → null (first-run hero covers it)", () => {
    expect(deriveStreakMoment(prev({ streak: 0 }), cur({ streak: 0 }), TODAY)).toBeNull();
  });

  it("flags levelUp independently of state", () => {
    const r = deriveStreakMoment(prev({ level: 3 }), cur({ level: 4 }), TODAY);
    expect(r.levelUp).toBe(true);
    expect(deriveStreakMoment(prev(), cur(), TODAY).levelUp).toBe(false);
  });
});

describe("weekStrip", () => {
  it("returns 7 tiles ending today with the streak window lit", () => {
    const days = weekStrip(3, new Date("2026-02-21T12:00:00"));
    expect(days).toHaveLength(7);
    expect(days[6].today).toBe(true);
    expect(days.filter((d) => d.lit)).toHaveLength(3);
    expect(days[6].lit && days[5].lit && days[4].lit).toBe(true);
    expect(days[3].lit).toBe(false);
  });

  it("streak ≥ 7 lights every tile; 0 lights none", () => {
    expect(weekStrip(9).every((d) => d.lit)).toBe(true);
    expect(weekStrip(0).every((d) => !d.lit)).toBe(true);
  });

  it("keys are local-day YYYY-MM-DD, not UTC", () => {
    const days = weekStrip(1, new Date("2026-02-21T12:00:00"));
    expect(days[6].key).toBe("2026-02-21");
  });
});
