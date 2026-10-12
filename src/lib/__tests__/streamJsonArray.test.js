import { describe, it, expect, vi } from "vitest";
import { createArrayStreamParser } from "../streamJsonArray.js";

const collect = () => {
  const items = [];
  const parser = createArrayStreamParser((o) => items.push(o));
  return { parser, items };
};

// Feed text in small chunks like an SSE token stream would — onToken always
// receives the ACCUMULATED text, and a duplicate final push must not re-emit.
const feed = (parser, text, chunkSize = 7) => {
  let acc = "";
  for (let i = 0; i < text.length; i += chunkSize) {
    acc += text.slice(i, i + chunkSize);
    parser.push(acc);
  }
  parser.push(acc);
};

describe("createArrayStreamParser", () => {
  it("emits each object once as it completes across chunk boundaries", () => {
    const { parser, items } = collect();
    feed(parser, '[{"a":1},{"a":2},{"a":3}]', 3);
    expect(items).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it("tolerates leading prose and ```json fences", () => {
    const { parser, items } = collect();
    feed(parser, 'Here you go:\n```json\n[{"q":"x","correct":"A"}]\n```', 5);
    expect(items).toEqual([{ q: "x", correct: "A" }]);
  });

  it("tracks nested objects and braces inside strings", () => {
    const { parser, items } = collect();
    // JSON.stringify guarantees a valid fixture (braces inside strings)
    const rows = [{ o: { deep: { n: 1 } }, s: "a } { brace" }, { z: 0 }];
    feed(parser, JSON.stringify(rows), 4);
    expect(items).toEqual(rows);
  });

  it("handles escaped quotes inside strings", () => {
    const { parser, items } = collect();
    const rows = [{ s: 'x "in" y' }, { s: '"' }, { s: "tail }{" }];
    feed(parser, JSON.stringify(rows), 6);
    expect(items).toEqual(rows);
  });

  it("never emits a truncated tail object", () => {
    const { parser, items } = collect();
    feed(parser, '[{"a":1},{"b":2},{"c":', 4);
    expect(items).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it("skips malformed objects without killing the stream", () => {
    const { parser, items } = collect();
    feed(parser, '[{"a":1,},{"ok":true}]', 3);
    expect(items).toEqual([{ ok: true }]);
  });

  it("handles an empty array and empty text", () => {
    const onItem = vi.fn();
    const parser = createArrayStreamParser(onItem);
    parser.push("");
    parser.push("[]");
    expect(onItem).not.toHaveBeenCalled();
  });

  it("emits incrementally, not only at the end", () => {
    const { parser, items } = collect();
    parser.push('[{"a":1},');
    expect(items).toEqual([{ a: 1 }]);
    parser.push('[{"a":1},{"b":2}');
    expect(items).toEqual([{ a: 1 }, { b: 2 }]);
  });
});
