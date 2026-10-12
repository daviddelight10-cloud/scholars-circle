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
