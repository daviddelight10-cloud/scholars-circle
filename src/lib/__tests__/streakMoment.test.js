import { describe, it, expect } from "vitest";
import { deriveStreakMoment, weekStrip, monthCells, shiftMonth } from "../../hooks/useStreakMoment.js";

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

describe("monthCells", () => {
  it("pads with blanks to the month's first weekday (Sunday-first)", () => {
    // 2026-02-01 was a Sunday → zero leading blanks, 28 day cells.
    const feb = monthCells("2026-02");
    expect(feb.filter(Boolean)).toHaveLength(28);
    expect(feb[0]).toMatchObject({ key: "2026-02-01", day: 1 });
    // 2026-03-01 was a Sunday too? No — check a mid-week month instead:
    const cells = monthCells("2026-10"); // Oct 1 2026 = Thursday → 4 blanks
    expect(cells[0]).toBeNull();
    expect(cells[3]).toBeNull();
    expect(cells[4]).toMatchObject({ key: "2026-10-01", day: 1 });
    expect(cells.filter(Boolean)).toHaveLength(31);
  });

  it("leap-year February has 29 cells", () => {
    expect(monthCells("2028-02").filter(Boolean)).toHaveLength(29);
    expect(monthCells("2026-02").filter(Boolean)).toHaveLength(28);
  });
});

describe("shiftMonth", () => {
  it("shifts forward and backward across year boundaries", () => {
    expect(shiftMonth("2026-10", 1)).toBe("2026-11");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-10", -1)).toBe("2026-09");
    expect(shiftMonth("2026-03", -3)).toBe("2025-12");
  });
});
