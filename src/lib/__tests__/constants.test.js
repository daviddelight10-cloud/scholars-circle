import { describe, it, expect } from "vitest";
import { BADGES, LEAGUES, API_BASE, EMPTY_STATS, DEMO_LIMITS } from "../constants";

describe("BADGES", () => {
  it("have unique ids", () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all define icon, label, desc and a check function", () => {
    for (const b of BADGES) {
      expect(b.icon, b.id).toBeTruthy();
      expect(b.label, b.id).toBeTruthy();
      expect(b.desc, b.id).toBeTruthy();
      expect(typeof b.check, b.id).toBe("function");
    }
  });

  it("session badges unlock at the documented thresholds", () => {
    const check = (id, stats, history = [], subjects = [], mastery = {}) =>
      BADGES.find((b) => b.id === id).check(stats, history, subjects, mastery);

    expect(check("first_session", { sessions: 0 })).toBe(false);
    expect(check("first_session", { sessions: 1 })).toBe(true);
    expect(check("sessions_10", { sessions: 9 })).toBe(false);
    expect(check("sessions_10", { sessions: 10 })).toBe(true);
    expect(check("sessions_100", { sessions: 100 })).toBe(true);
  });

  it("streak badges unlock at the documented thresholds", () => {
    const check = (id, stats) => BADGES.find((b) => b.id === id).check(stats, []);

    expect(check("streak_3", { streak: 2 })).toBe(false);
    expect(check("streak_3", { streak: 3 })).toBe(true);
    expect(check("streak_30", { streak: 29 })).toBe(false);
    expect(check("streak_30", { streak: 30 })).toBe(true);
  });

  it("perfect_score only counts full-score exams", () => {
    const check = (history) => BADGES.find((b) => b.id === "perfect_score").check({}, history);

    expect(check([{ score: 9, total: 10, mode: "exam" }])).toBe(false);
    expect(check([{ score: 10, total: 10, mode: "exam" }])).toBe(true);
    // a perfect practice round is not an exam
    expect(check([{ score: 10, total: 10, mode: "practice" }])).toBe(false);
    // guard against division-style edge: total must be > 0
    expect(check([{ score: 0, total: 0, mode: "exam" }])).toBe(false);
  });

  it("time badges read the session hour", () => {
    const check = (id, ts) => BADGES.find((b) => b.id === id).check({}, [{ ts }]);

    const elevenPm = new Date();
    elevenPm.setHours(23, 0, 0, 0);
    expect(check("night_owl", elevenPm.getTime())).toBe(true);

    const fiveAm = new Date();
    fiveAm.setHours(5, 0, 0, 0);
    expect(check("early_bird", fiveAm.getTime())).toBe(true);
    expect(check("night_owl", fiveAm.getTime())).toBe(false);
  });

  it("mastery badges read the mastery map", () => {
    const check = (id, mastery) =>
      BADGES.find((b) => b.id === id).check({}, [], [], mastery);

    expect(check("mastery_80", { bio101: 79 })).toBe(false);
    expect(check("mastery_80", { bio101: 80 })).toBe(true);
    expect(check("mastery_100", { bio101: 100 })).toBe(true);
  });
});

describe("LEAGUES", () => {
  it("are ordered by ascending XP requirement", () => {
    for (let i = 1; i < LEAGUES.length; i++) {
      expect(LEAGUES[i].minXP).toBeGreaterThan(LEAGUES[i - 1].minXP);
    }
    expect(LEAGUES[0].minXP).toBe(0);
  });

  it("have unique ids and icons", () => {
    expect(new Set(LEAGUES.map((l) => l.id)).size).toBe(LEAGUES.length);
    expect(new Set(LEAGUES.map((l) => l.icon)).size).toBe(LEAGUES.length);
  });
});

describe("misc exports", () => {
  it("API_BASE is a non-empty URL string", () => {
    expect(typeof API_BASE).toBe("string");
    expect(API_BASE.length).toBeGreaterThan(0);
  });

  it("EMPTY_STATS zeroes the progress counters and keeps the default weekly goal", () => {
    for (const key of ["xp", "sessions", "streak", "coins", "totalCorrect"]) {
      expect(EMPTY_STATS[key], key).toBe(0);
    }
    expect(EMPTY_STATS.weeklyGoal).toBeGreaterThan(0);
  });

  it("DEMO_LIMITS define sane positive caps", () => {
    expect(DEMO_LIMITS.aiMessages).toBeGreaterThan(0);
    expect(DEMO_LIMITS.trialDays).toBeGreaterThan(0);
    expect(DEMO_LIMITS.allowedTabs.length).toBeGreaterThan(0);
  });
});
