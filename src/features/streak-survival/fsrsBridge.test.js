import { describe, it, expect } from "vitest";
import { deriveRating, readingBudgetMs, normalizeQuestion, normalizeBank, isRenderableQuestion, topicStats, tallyTopics, buildSession, isVignette } from "./fsrsBridge";

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

describe("normalizeQuestion hardening", () => {
  it("falls back to alternate stem keys", () => {
    for (const k of ["stem", "text", "questionText", "body"]) {
      const q = normalizeQuestion({ [k]: "Stem?", options: { A: "x", B: "y" }, correct: "A" });
      expect(q.q).toBe("Stem?");
    }
  });

  it("is null-safe and flags malformed rows as unrenderable", () => {
    expect(normalizeQuestion(null).q).toBe("");
    expect(normalizeQuestion(undefined).opts).toEqual([]);
    expect(isRenderableQuestion(normalizeQuestion(null))).toBe(false);
    // options but no stem — the reported blank-question shape
    expect(isRenderableQuestion(normalizeQuestion({ options: { A: "x", B: "y" }, correct: "A" }))).toBe(false);
    // stem but too few usable options
    expect(isRenderableQuestion(normalizeQuestion({ question: "Q", options: { A: "x" }, correct: "A" }))).toBe(false);
    expect(isRenderableQuestion(normalizeQuestion({ question: "Q", options: { A: "x", B: "" }, correct: "A" }))).toBe(false);
    expect(isRenderableQuestion(mk(1))).toBe(true);
  });

  it("coerces option values to strings and resolves numeric correct", () => {
    const q = normalizeQuestion({ question: "Q?", options: { A: 42, B: true }, correct: 1 });
    expect(q.opts).toEqual(["42", "true"]);
    expect(q.a).toBe(1);
    expect(normalizeQuestion({ question: "Q?", options: { A: "x", B: "y" }, correct: "B" }).a).toBe(1);
    expect(normalizeQuestion({ question: "Q?", options: { A: "x", B: "y" }, correct: "1" }).a).toBe(1);
  });

  it("resolves a correct answer stored as option text", () => {
    expect(normalizeQuestion({ question: "Q?", options: { A: "London", B: "Paris" }, correct: "Paris" }).a).toBe(1);
    expect(normalizeQuestion({ question: "Q?", options: { A: "True", B: "False" }, correct: "false" }).a).toBe(1);
  });

  it("keeps true/false rows renderable", () => {
    const tf = normalizeQuestion({ question: "Sky is blue", options: { A: "True", B: "False" }, correct: "B", format: "tf" });
    expect(tf.opts).toEqual(["True", "False"]);
    expect(tf.a).toBe(1);
    expect(tf._qFormat).toBe("tf");
    expect(isRenderableQuestion(tf)).toBe(true);
  });
});

describe("normalizeBank", () => {
  it("drops rows that cannot render, preserving original indices", () => {
    const bank = normalizeBank([
      { question: "Good?", options: { A: "x", B: "y" }, correct: "A" },
      { options: { A: "x", B: "y" }, correct: "A" },
      { stem: "Alt stem?", options: { A: "x", B: "y" }, correct: "A" },
      null,
      { question: "Short", options: { A: "only" }, correct: "A" },
    ], "r1");
    expect(bank.length).toBe(2);
    expect(bank[0].q).toBe("Good?");
    expect(bank[1].q).toBe("Alt stem?");
    expect(bank[1]._pageIndex).toBe(2);
  });

  it("returns [] for non-array or unparseable input", () => {
    expect(normalizeBank("not json")).toEqual([]);
    expect(normalizeBank("{}")).toEqual([]);
    expect(normalizeBank(null)).toEqual([]);
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
