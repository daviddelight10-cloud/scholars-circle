import { describe, it, expect } from "vitest";
import { fmtTime, playableSections, buildLessonContext } from "./lessonUtils.js";

describe("fmtTime", () => {
  it("formats mm:ss", () => {
    expect(fmtTime(0)).toBe("0:00");
    expect(fmtTime(9000)).toBe("0:09");
    expect(fmtTime(65000)).toBe("1:05");
    expect(fmtTime(600000)).toBe("10:00");
  });
  it("clamps negatives", () => {
    expect(fmtTime(-500)).toBe("0:00");
  });
});

describe("playableSections", () => {
  const lesson = { sections: [{ id: "s1", heading: "A" }, { id: "s2", heading: "B" }] };
  it("maps audio rows by sectionId and flags playable", () => {
    const audio = [
      { sectionId: "s1", status: "ready", url: "https://x/1.mp3" },
      { sectionId: "s2", status: "pending", url: null },
    ];
    const out = playableSections(lesson, audio);
    expect(out).toHaveLength(2);
    expect(out[0].playable).toBe(true);
    expect(out[1].playable).toBe(false);
  });
  it("handles missing audio", () => {
    expect(playableSections(lesson, null).every((s) => !s.playable)).toBe(true);
    expect(playableSections(null, [])).toEqual([]);
  });
});

describe("buildLessonContext", () => {
  it("includes title, page and key points", () => {
    const ctx = buildLessonContext(
      { page_title: "The nephron", key_points: ["kidney filters blood"], sections: [{ heading: "H", explanation: "x" }] },
      7, "Renal Physiology"
    );
    expect(ctx).toContain("page 7");
    expect(ctx).toContain("The nephron");
    expect(ctx).toContain("kidney filters blood");
  });
  it("caps length and tolerates empty lesson", () => {
    expect(buildLessonContext(null, 1)).toBe("");
    const big = { page_title: "t", key_points: Array(50).fill("k".repeat(200)), sections: [] };
    expect(buildLessonContext(big, 1).length).toBeLessThanOrEqual(2800);
  });
});
