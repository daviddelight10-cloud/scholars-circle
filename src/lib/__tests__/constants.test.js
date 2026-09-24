import { describe, it, expect } from "vitest";
import { LEAGUES, API_BASE, EMPTY_STATS, DEMO_LIMITS } from "../constants";
import { BADGES, BADGE_GROUPS, resolveBadges } from "../badges";

const baseCtx = (over = {}) => ({
  stats: {},
  history: [],
  subjects: [],
  save: {},
  fsrsStats: {},
  analytics: null,
  community: {},
  vpCases: 0,
  ...over,
});

const resolved = (id, ctx) => resolveBadges(baseCtx(ctx)).find((b) => b.id === id);
const earned = (id, ctx) => resolved(id, ctx)?.earned;
const prog = (id, ctx) => resolved(id, ctx) && { cur: resolved(id, ctx).cur, max: resolved(id, ctx).max };

describe("BADGES", () => {
  it("have unique ids", () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all define icon, label, desc, a known group and a progress function", () => {
    const groupIds = new Set(BADGE_GROUPS.map((g) => g.id));
    const rarities = new Set(["common", "rare", "legendary"]);
    for (const b of BADGES) {
      expect(b.icon, b.id).toBeTruthy();
      expect(b.label, b.id).toBeTruthy();
      expect(b.desc, b.id).toBeTruthy();
      expect(groupIds.has(b.group), `${b.id} group`).toBe(true);
      expect(typeof b.progress, b.id).toBe("function");
      if (b.rarity) expect(rarities.has(b.rarity), `${b.id} rarity`).toBe(true);
    }
  });

  it("resolveBadges never throws on an empty ctx and clamps progress", () => {
    const rows = resolveBadges(baseCtx());
    for (const r of rows) {
      expect(r.cur).toBeGreaterThanOrEqual(0);
      expect(r.cur).toBeLessThanOrEqual(r.max);
      expect(typeof r.earned).toBe("boolean");
    }
  });

  it("streak badges use best of streak/longestStreak", () => {
    expect(earned("streak_3", { fsrsStats: { streak: 2 } })).toBe(false);
    expect(earned("streak_3", { fsrsStats: { streak: 3 } })).toBe(true);
    // past longest streak still counts as earned
    expect(earned("streak_7", { fsrsStats: { streak: 1, longestStreak: 9 } })).toBe(true);
    expect(earned("streak_30", { fsrsStats: { streak: 29, longestStreak: 29 } })).toBe(false);
  });

  it("first_review needs at least one item past new-state", () => {
    expect(earned("first_review", { fsrsStats: { learningCount: 0, reviewCount: 0, masteredCount: 0 } })).toBe(false);
    expect(earned("first_review", { fsrsStats: { learningCount: 1 } })).toBe(true);
    expect(earned("first_review", { fsrsStats: { masteredCount: 5 } })).toBe(true);
  });

  it("goal_crusher requires reviewedToday >= dailyGoal", () => {
    expect(earned("goal_crusher", { fsrsStats: { dailyGoal: 20, reviewedToday: 19 } })).toBe(false);
    expect(earned("goal_crusher", { fsrsStats: { dailyGoal: 20, reviewedToday: 20 } })).toBe(true);
    expect(earned("goal_crusher", { fsrsStats: { dailyGoal: 0, reviewedToday: 50 } })).toBe(false);
  });

  it("week_clean needs a review on each of the last 7 days", () => {
    const dailyReviews = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dailyReviews[d.toISOString().slice(0, 10)] = 2;
    }
    expect(earned("week_clean", { analytics: { dailyReviews } })).toBe(true);
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    dailyReviews[yesterday.toISOString().slice(0, 10)] = 0;
    expect(earned("week_clean", { analytics: { dailyReviews } })).toBe(false);
    expect(prog("week_clean", { analytics: { dailyReviews } })).toEqual({ cur: 6, max: 7 });
  });

  it("mastered/review-count badges track fsrsStats totals", () => {
    expect(earned("mastered_10", { fsrsStats: { masteredCount: 9 } })).toBe(false);
    expect(earned("mastered_10", { fsrsStats: { masteredCount: 10 } })).toBe(true);
    expect(earned("reviews_100", { fsrsStats: { totalReviews: 100 } })).toBe(true);
    expect(prog("deep_deck", { fsrsStats: { totalItems: 250 } })).toEqual({ cur: 250, max: 500 });
  });

  it("practice badges read the survival save", () => {
    expect(earned("answered_100", { save: { stats: { answered: 99 } } })).toBe(false);
    expect(earned("answered_100", { save: { stats: { answered: 100 } } })).toBe(true);
    expect(earned("sharp_80", { save: { stats: { answered: 100, correct: 79 } } })).toBe(false);
    expect(earned("sharp_80", { save: { stats: { answered: 100, correct: 80 } } })).toBe(true);
    // accuracy badge requires the sample size, not just a lucky few
    expect(earned("sharp_80", { save: { stats: { answered: 4, correct: 4 } } })).toBe(false);
    expect(earned("flawless", { save: { stats: { perfectRuns: 1 } } })).toBe(true);
    expect(earned("quest_day", { save: { questClaimed: ["a", "b", "c"] } })).toBe(true);
  });

  it("level badges derive from survival xp", () => {
    // level 1→5 costs 120+180+240+300 = 840 xp
    expect(earned("level_5", { save: { xp: 100 } })).toBe(false);
    expect(earned("level_5", { save: { xp: 900 } })).toBe(true);
  });

  it("time badges read the session hour from history", () => {
    const elevenPm = new Date(); elevenPm.setHours(23, 0, 0, 0);
    const fiveAm = new Date(); fiveAm.setHours(5, 0, 0, 0);
    expect(earned("night_owl", { history: [{ ts: elevenPm.getTime() }] })).toBe(true);
    expect(earned("early_bird", { history: [{ ts: fiveAm.getTime() }] })).toBe(true);
    expect(earned("night_owl", { history: [{ ts: fiveAm.getTime() }] })).toBe(false);
  });

  it("explore badges read community + clinical data", () => {
    expect(earned("curator", { community: { saved: 5 } })).toBe(true);
    expect(earned("contributor", { community: { uploads: 2 } })).toBe(false);
    expect(earned("vp_intern", { vpCases: 1 })).toBe(true);
    expect(earned("polyglot", { fsrsStats: { bySubject: { A: {}, B: {}, C: {} } } })).toBe(true);
  });

  it("secret badges stay hidden and unlock on their condition", () => {
    const comeback = BADGES.find((b) => b.id === "comeback");
    expect(comeback.hidden).toBe(true);
    const old = Date.now() - 10 * 86400000;
    const recent = Date.now() - 3600000;
    expect(earned("comeback", { history: [{ ts: old }, { ts: recent }] })).toBe(true);
    expect(earned("comeback", { history: [{ ts: recent }] })).toBe(false);
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
