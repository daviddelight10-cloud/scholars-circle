import { describe, it, expect } from "vitest";
import { deriveRating, readingBudgetMs, normalizeQuestion, topicStats, tallyTopics, buildSession, isVignette } from "./fsrsBridge";

const mk = (i, extra = {}) => normalizeQuestion({ question: `Q${i}?`, options: { A: "a", B: "b", C: "c", D: "d" }, correct: "A", ...extra }, i, "r1");

describe("reading budget and rating", () => {
  it("keeps short questions at the 7s floor and gives long vignettes more", () => {
    expect(readingBudgetMs(mk(1))).toBe(7000);
    const long = { q: "word ".repeat(120), opts: ["some long option text here", "another long option here", "third option text", "fourth option"] };
    expect(readingBudgetMs(long)).toBeGreaterThan(18000);
  });

  it("rates exactly as before at the default budget", () => {
    expect(deriveRating({ correct: true, elapsedMs: 6000, via: "mcq" })).toBe(4);
    expect(deriveRating({ correct: true, elapsedMs: 12000, via: "mcq" })).toBe(3);
    expect(deriveRating({ correct: true, elapsedMs: 21000, via: "mcq" })).toBe(2);
    expect(deriveRating({ correct: false, elapsedMs: 1000 })).toBe(1);
  });

  it("scales Easy/Hard thresholds with the reading budget", () => {
    const budgetMs = 21000; // 3x
    expect(deriveRating({ correct: true, elapsedMs: 20000, via: "mcq", budgetMs })).toBe(4);
    expect(deriveRating({ correct: true, elapsedMs: 40000, via: "mcq", budgetMs })).toBe(3);
    expect(deriveRating({ correct: true, elapsedMs: 61000, via: "mcq", budgetMs })).toBe(2);
  });
});

describe("question metadata", () => {
  it("keeps topic, difficulty and type; ignores invalid values", () => {
    const q = mk(1, { topic: "Brachial plexus", difficulty: "hard", qtype: "vignette" });
    expect(q._qTopic).toBe("Brachial plexus");
    expect(q._qDiff).toBe("hard");
    expect(q._qType).toBe("vignette");
    expect(isVignette(q)).toBe(true);
    const bad = mk(2, { difficulty: "insane", qtype: "essay" });
    expect(bad._qDiff).toBeNull();
    expect(bad._qType).toBeNull();
  });
});

describe("topics", () => {
  const bank = [mk(0, { topic: "Renal" }), mk(1, { topic: "renal" }), mk(2, { topic: "Cardiac" }), mk(3)];
  const states = { "r1:0": { isMastered: true }, "r1:1": { stability: 30 }, "r1:2": { isDue: true } };

  it("groups topics case-insensitively and sorts weakest first", () => {
    const t = topicStats(bank, states);
    expect(t.map((x) => x.topic)).toEqual(["Cardiac", "Renal"]);
    expect(t[1]).toMatchObject({ total: 2, mastered: 2, pct: 100 });
    expect(t[0]).toMatchObject({ total: 1, due: 1, pct: 0 });
  });

  it("tallies run accuracy per topic", () => {
    const t = tallyTopics([{ q: bank[0], ok: true }, { q: bank[1], ok: false }, { q: bank[2], ok: false }, { q: bank[3], ok: true }]);
    expect(t.find((x) => x.topic === "Renal")).toMatchObject({ total: 2, correct: 1, pct: 50 });
    expect(t.length).toBe(2);
  });
});

describe("buildSession", () => {
  const big = Array.from({ length: 60 }, (_, i) => mk(i, { topic: i % 2 ? "A" : "B" }));

  it("plays 12 by default and puts due cards first", () => {
    const states = { "r1:5": { state: 2, isDue: true, stability: 1, dueAt: "2020-01-01" }, "r1:9": { state: 2, isDue: true, stability: 2, dueAt: "2020-02-01" } };
    const s = buildSession(big, states);
    expect(s.indices.length).toBe(12);
    expect(s.indices.slice(0, 2)).toEqual([5, 9]);
    expect(s.due).toBe(2);
  });

  it("grows to the due count (max 20) and never exceeds the pool", () => {
    const states = {};
    for (let i = 0; i < 30; i++) states[`r1:${i}`] = { state: 2, isDue: true, stability: 1, dueAt: "2020-01-01" };
    expect(buildSession(big, states).indices.length).toBe(20);
    expect(buildSession(big.slice(0, 5), {}).indices.length).toBe(5);
  });

  it("respects topic scope and exclusions", () => {
    const s = buildSession(big, {}, { topics: ["a"], exclude: new Set([1, 3]) });
    expect(s.indices.every((i) => i % 2 === 1 && i !== 1 && i !== 3)).toBe(true);
  });
});
