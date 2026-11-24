import { describe, it, expect } from "vitest";
import { chunkNarration } from "./speech.js";

describe("chunkNarration", () => {
  it("splits on sentence boundaries and merges short ones", () => {
    const out = chunkNarration("The kidney filters blood. It also makes urine. Glucose is reabsorbed in the proximal tubule under normal conditions.");
    expect(out.length).toBeGreaterThanOrEqual(1);
    expect(out.join(" ")).toContain("kidney filters blood");
    expect(out.every((c) => c.length <= 240)).toBe(true);
  });
  it("hard-splits a single long sentence", () => {
    const long = "word ".repeat(120).trim() + ".";
    const out = chunkNarration(long);
    expect(out.length).toBeGreaterThan(1);
    expect(out.every((c) => c.length <= 240)).toBe(true);
  });
  it("returns empty for blank input", () => {
    expect(chunkNarration("")).toEqual([]);
    expect(chunkNarration(null)).toEqual([]);
  });
});
