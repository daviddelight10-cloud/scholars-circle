import { describe, it, expect } from "vitest";
import {
  normalizeQuestion,
  normalizeExamPayload,
  gradeObjectiveAnswer,
  shuffleMcqOptions,
  countByType,
  totalMarks,
} from "./examSchema";

describe("normalizeQuestion", () => {
  it("normalizes an mcq with array options and numeric correct", () => {
    const q = normalizeQuestion({
      type: "mcq",
      question: "2+2?",
      options: ["3", "4", "5", "6"],
      correct: 1,
    });
    expect(q.type).toBe("mcq");
    expect(q.options.B).toBe("4");
    expect(q.correct).toBe("B");
    expect(q.marks).toBe(1);
  });

  it("rejects an mcq with a bad correct letter", () => {
    expect(
      normalizeQuestion({ type: "mcq", question: "?", options: { A: "x", B: "y" }, correct: "Z" })
    ).toBeNull();
  });

  it("normalizes truefalse from string", () => {
    const q = normalizeQuestion({ type: "truefalse", question: "Sky is blue", correct: "true" });
    expect(q.correct).toBe(true);
  });

  it("collects acceptableAnswers for fillblank", () => {
    const q = normalizeQuestion({
      type: "fillblank",
      question: "The capital is ____",
      answer: "Paris",
      acceptableAnswers: ["paris", "Paris, France"],
    });
    expect(q.acceptableAnswers).toContain("Paris");
    expect(q.acceptableAnswers.length).toBe(3); // exact-match dedupe keeps "Paris" and "paris"
  });

  it("requires a modelAnswer for written types", () => {
    expect(normalizeQuestion({ type: "essay", question: "Discuss X" })).toBeNull();
    const q = normalizeQuestion({
      type: "essay",
      question: "Discuss X",
      modelAnswer: "X is...",
      markingScheme: "point one\npoint two",
    });
    expect(q.modelAnswer).toBe("X is...");
    expect(q.markingScheme).toEqual(["point one", "point two"]);
    expect(q.marks).toBe(10);
  });

  it("rejects unknown types and empty stems", () => {
    expect(normalizeQuestion({ type: "matching", question: "x" })).toBeNull();
    expect(normalizeQuestion({ type: "mcq", question: "" })).toBeNull();
  });
});

describe("normalizeExamPayload", () => {
  const payload = {
    kind: "exam",
    config: { name: "Test", timeLimitMin: 20, mode: "practice", passMarkPct: 60 },
    questions: [
      { type: "mcq", question: "q1", options: { A: "a", B: "b" }, correct: "A" },
      { type: "essay", question: "q2", modelAnswer: "ans" },
    ],
  };

  it("normalizes a valid payload", () => {
    const p = normalizeExamPayload(payload);
    expect(p.questions).toHaveLength(2);
    expect(p.config.mode).toBe("practice");
    expect(p.config.passMarkPct).toBe(60);
  });

  it("returns null for non-exam or empty payloads", () => {
    expect(normalizeExamPayload(null)).toBeNull();
    expect(normalizeExamPayload({ kind: "exam", questions: [] })).toBeNull();
    expect(normalizeExamPayload({ kind: "mcq", questions: [{}] })).toBeNull();
  });

  it("drops invalid questions but keeps valid ones", () => {
    const p = normalizeExamPayload({
      kind: "exam",
      questions: [{ type: "bogus", question: "x" }, payload.questions[0]],
    });
    expect(p.questions).toHaveLength(1);
  });
});

describe("gradeObjectiveAnswer", () => {
  const mcq = { type: "mcq", marks: 1, options: { A: "a", B: "b" }, correct: "B" };
  const tf = { type: "truefalse", marks: 1, correct: false };
  const fb = { type: "fillblank", marks: 1, acceptableAnswers: ["mitochondria", "mitochondrion"] };

  it("grades mcq case-insensitively", () => {
    expect(gradeObjectiveAnswer(mcq, "b").correct).toBe(true);
    expect(gradeObjectiveAnswer(mcq, "a").correct).toBe(false);
  });

  it("grades truefalse", () => {
    expect(gradeObjectiveAnswer(tf, false).correct).toBe(true);
    expect(gradeObjectiveAnswer(tf, true).correct).toBe(false);
  });

  it("grades fillblank with punctuation/case tolerance", () => {
    expect(gradeObjectiveAnswer(fb, "Mitochondria!").correct).toBe(true);
    expect(gradeObjectiveAnswer(fb, "nucleus").correct).toBe(false);
  });

  it("marks blank answers as wrong with zero marks", () => {
    const g = gradeObjectiveAnswer(mcq, "");
    expect(g.correct).toBe(false);
    expect(g.marksAwarded).toBe(0);
    expect(g.blank).toBe(true);
  });

  it("returns null for written types", () => {
    expect(gradeObjectiveAnswer({ type: "essay" }, "text")).toBeNull();
  });
});

describe("helpers", () => {
  it("shuffleMcqOptions remaps the correct letter", () => {
    const q = { type: "mcq", options: { A: "a", B: "b", C: "c", D: "d" }, correct: "C" };
    const s = shuffleMcqOptions(q);
    expect(Object.keys(s.options)).toEqual(["A", "B", "C", "D"]);
    expect(s.options[s.correct]).toBe("c");
  });

  it("countByType and totalMarks tally correctly", () => {
    const items = [
      { type: "mcq", marks: 1 },
      { type: "mcq", marks: 1 },
      { type: "essay", marks: 10 },
    ];
    expect(countByType(items)).toEqual({ mcq: 2, essay: 1 });
    expect(totalMarks(items)).toBe(12);
  });
});
