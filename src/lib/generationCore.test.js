import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./aiClient", async (importOriginal) => {
  const orig = await importOriginal();
  return { ...orig, callAI: vi.fn(), callAIMultimodal: vi.fn(), callAIStream: vi.fn() };
});

import { callAI, callAIStream } from "./aiClient";
import { generateMcqs, countExistingMcqs } from "./generationCore";

function makeMcqDoc(n) {
  let t = "";
  for (let i = 1; i <= n; i++) {
    t += `${i}. Question number ${i} about physiology?\nA) option A${i}\nB) option B${i}\nC) option C${i}\nD) option D${i}\n\n`;
  }
  return t;
}

// Parse the synthetic questions embedded in a prompt's chunk text
function questionsInPrompt(prompt) {
  const m = prompt.match(/"""([\s\S]*?)"""/);
  const chunk = m ? m[1] : prompt;
  const re = /(\d+)\.\s*(Question[^\n]*\?)\nA\)\s*([^\n]+)\nB\)\s*([^\n]+)\nC\)\s*([^\n]+)\nD\)\s*([^\n]+)/g;
  const rows = [];
  let mm;
  while ((mm = re.exec(chunk))) {
    rows.push({
      question: `Q${mm[1]}: ${mm[2]}`,
      options: { A: mm[3], B: mm[4], C: mm[5], D: mm[6] },
      correct: "A",
      explanation: "",
    });
  }
  return rows;
}

beforeEach(() => {
  callAI.mockReset();
  callAIStream.mockReset();
});

const mcqRowsJson = (n) => JSON.stringify(
  Array.from({ length: n }, (_, i) => ({
    question: `Streamed q${i}?`,
    options: { A: "a", B: "b", C: "c", D: "d" },
    correct: "A",
    explanation: "why",
  }))
);

describe("streaming onRows", () => {
  const doc = "Some study content about renal physiology. ".repeat(90);

  it("emits each question as it is written (per-question streaming)", async () => {
    const full = mcqRowsJson(10);
    callAIStream.mockImplementation(async (_p, _cfg, { onToken }) => {
      // Simulate a token stream — push the text in slices.
      let acc = "";
      for (let i = 0; i < full.length; i += 40) {
        acc += full.slice(i, i + 40);
        onToken?.(acc);
      }
      return full;
    });

    const arrivals = [];
    const { rows } = await generateMcqs(doc, [], () => {}, {
      onRows: (r) => arrivals.push(...r),
    });

    expect(rows.length).toBe(10);
    expect(arrivals.length).toBe(10);
    expect(arrivals.map((r) => r.question)).toEqual(rows.map((r) => r.question));
  });

  it("falls back to per-chunk rows when no token events fire", async () => {
    callAIStream.mockImplementation(async () => mcqRowsJson(7)); // buffered
    const arrivals = [];
    const { rows } = await generateMcqs(doc, [], () => {}, { onRows: (r) => arrivals.push(...r) });
    expect(rows.length).toBe(7);
    expect(arrivals.length).toBe(7); // emitted once at chunk completion
  });

  it("an aborted signal stops generation before chunks run", async () => {
    const ctl = new AbortController();
    ctl.abort();
    callAIStream.mockImplementation(async () => mcqRowsJson(10));
    await expect(generateMcqs(doc, [], () => {}, { signal: ctl.signal, onRows: () => {} }))
      .rejects.toMatchObject({ stoppedByUser: true });
    expect(callAIStream).not.toHaveBeenCalled();
  });

  it("non-streaming callers keep using callAI exactly as before", async () => {
    callAI.mockImplementation(async () => mcqRowsJson(4));
    await generateMcqs(doc, [], () => {});
    expect(callAI).toHaveBeenCalled();
    expect(callAIStream).not.toHaveBeenCalled();
  });
});

describe("extraction mode (MCQ-bank document)", () => {
  it("detects the question count", () => {
    expect(countExistingMcqs(makeMcqDoc(30))).toBe(30);
  });

  it("doesn't treat a numbered list without option markers as a bank", () => {
    const listDoc = "Chapter summary points.\n\n" +
      Array.from({ length: 12 }, (_, i) => `${i + 1}. Concept number ${i + 1} explained briefly`).join("\n");
    expect(countExistingMcqs(listDoc)).toBe(0);
  });

  it("doesn't treat question-mark lines without options as a bank", () => {
    const faqDoc = "Frequently asked things.\n\n" +
      Array.from({ length: 12 }, (_, i) => `What is concept ${i + 1} in physiology?`).join("\n");
    expect(countExistingMcqs(faqDoc)).toBe(0);
  });

  it("falls back to generation when extraction finds no questions", async () => {
    // Passes the heuristic (option markers + stems) but isn't a real bank —
    // the extractor returns [] for every pass, then generation runs instead.
    callAI.mockImplementation(async (prompt) =>
      prompt.includes("Generate exactly") ? mcqRowsJson(6) : "[]"
    );
    const { rows } = await generateMcqs(makeMcqDoc(10), [], () => {});
    expect(rows.length).toBe(6);
    // Last call must be a generation prompt, not another extract prompt.
    const lastPrompt = callAI.mock.calls.at(-1)[0];
    expect(lastPrompt).toContain("Generate exactly");
  });

  it("recovers underproduced chunks until the detected count is reached", async () => {
    // First pass: each chunk returns only half its questions.
    // Retry pass (retryHint): returns all of them.
    callAI.mockImplementation(async (prompt) => {
      const rows = questionsInPrompt(prompt);
      if (prompt.includes("previous pass missed")) return JSON.stringify(rows);
      return JSON.stringify(rows.slice(0, Math.ceil(rows.length / 2)));
    });

    const { rows } = await generateMcqs(makeMcqDoc(30), [], () => {});
    expect(rows.length).toBe(30);
    // single-chunk doc: 1 initial call (returns half) + 1 retry (returns all)
    expect(callAI.mock.calls.length).toBe(2);
  });
});

describe("generation mode (normal document)", () => {
  it("scales default target by document length", async () => {
    // ~3.6k-char doc with no existing MCQs → floor of 10
    callAI.mockImplementation(async (prompt) => {
      const count = parseInt(prompt.match(/Generate exactly (\d+)/)?.[1] || "0", 10);
      return JSON.stringify(
        Array.from({ length: count }, (_, i) => ({
          question: `Generated q${i}?`,
          options: { A: "a", B: "b", C: "c", D: "d" },
          correct: "A",
          explanation: "",
        }))
      );
    });

    const prose = "Some study content about renal physiology. ".repeat(90); // ~4k chars
    const { rows } = await generateMcqs(prose, [], () => {});
    expect(callAI.mock.calls[0][0]).toContain("Generate exactly 10");
    expect(rows.length).toBe(10);
  });
});

import { allocateQuestions, rebalanceAnswers, buildMcqPrompt, maxSupportedQuestions, autoQuestionCount, verifyMcqRows } from "./generationCore";

const mkRows = (n) => Array.from({ length: n }, (_, i) => ({
  question: `Rich question ${i} about cardiology?`,
  options: { A: `a${i}`, B: `b${i}`, C: `c${i}`, D: `d${i}` },
  correct: "B",
  explanation: "",
}));

describe("customise engine", () => {
  it("allocates questions across chunks in proportion to length and never above 25 each", () => {
    const out = allocateQuestions(["x".repeat(9000), "x".repeat(3000)], 20);
    expect(out.reduce((a, b) => a + b, 0)).toBe(20);
    expect(out[0]).toBeGreaterThan(out[1]);
    expect(allocateQuestions(["a", "b"], 100).every((n) => n <= 25)).toBe(true);
  });

  it("caps supported questions by material length and auto at 20", () => {
    expect(maxSupportedQuestions(30000)).toBe(150);
    expect(maxSupportedQuestions(1000)).toBe(10);
    expect(autoQuestionCount(100000)).toBe(20);
    expect(autoQuestionCount(1000)).toBe(10);
  });

  it("builds a clinical-vignette prompt with the chosen options", () => {
    const p = buildMcqPrompt("text", 12, { style: "vignette", difficulty: "hard", realWorld: true, highYield: true, focusTopic: "brachial plexus", rich: true });
    expect(p).toContain("Generate exactly 12");
    expect(p).toContain("clinical-vignette");
    expect(p).toContain("Difficulty: hard");
    expect(p).toContain("REAL-WORLD FOCUS");
    expect(p).toContain("HIGH-YIELD ONLY");
    expect(p).toContain("brachial plexus");
  });

  it("rebalances the correct letter and keeps the correct text", () => {
    const rows = mkRows(40);
    const out = rebalanceAnswers(rows);
    const counts = { A: 0, B: 0, C: 0, D: 0 };
    out.forEach((r, i) => {
      counts[r.correct]++;
      expect(r.options[r.correct]).toBe(`b${i}`);
    });
    Object.values(counts).forEach((c) => expect(c).toBe(10));
  });

  it("leaves questions with positional options untouched", () => {
    const rows = [{ question: "q?", options: { A: "x", B: "y", C: "z", D: "All of the above" }, correct: "D", explanation: "" }];
    expect(rebalanceAnswers(rows)).toEqual(rows);
  });

  it("verification drops bad questions and fixes wrong keys", async () => {
    callAI.mockResolvedValue(JSON.stringify([
      { i: 0, verdict: "ok" }, { i: 1, verdict: "fix", correct: "C" }, { i: 2, verdict: "drop" }, { i: 3, verdict: "ok" },
    ]));
    const out = await verifyMcqRows(mkRows(4), "source");
    expect(out.length).toBe(3);
    expect(out[1].correct).toBe("C");
  });

  it("verification never wipes the set (falls back when most are dropped or the call fails)", async () => {
    callAI.mockResolvedValue(JSON.stringify([{ i: 0, verdict: "drop" }, { i: 1, verdict: "drop" }, { i: 2, verdict: "drop" }]));
    expect((await verifyMcqRows(mkRows(3), "s")).length).toBe(3);
    callAI.mockRejectedValue(new Error("boom"));
    expect((await verifyMcqRows(mkRows(3), "s")).length).toBe(3);
  });

  it("autoTarget generates that many questions with the rich prompt", async () => {
    callAI.mockImplementation(async (prompt) => {
      const count = parseInt(prompt.match(/Generate exactly (\d+)/)?.[1] || "0", 10);
      return JSON.stringify(Array.from({ length: count }, (_, i) => ({ question: `Auto q${i} ${Math.random()}?`, options: { A: "a", B: "b", C: "c", D: "d" }, correct: "A", explanation: "", topic: "Renal", difficulty: "hard", type: "vignette" })));
    });
    const prose = "Some study content about renal physiology. ".repeat(2000);
    const { rows } = await generateMcqs(prose, [], () => {}, { autoTarget: 20, rich: true });
    expect(rows.length).toBe(20);
    expect(rows[0].topic).toBe("Renal");
    expect(callAI.mock.calls[0][0]).toContain("senior medical-school examiner");
  });
});
