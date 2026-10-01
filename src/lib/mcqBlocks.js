// Splits assistant message content into text and interactive-quiz segments.
// The AI emits quizzes as fenced blocks:
//   ```mcq
//   {"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}
//   ```
// Incomplete/unterminated fences (mid-stream) are silently dropped.
export function parseMcqSegments(content) {
  if (!content || !content.includes("```mcq")) {
    return [{ type: "text", text: content }];
  }

  const segments = [];
  const re = /```mcq\s*([\s\S]*?)(```|$)/g;
  let last = 0;
  let m;

  while ((m = re.exec(content))) {
    if (m.index > last) {
      segments.push({ type: "text", text: content.slice(last, m.index) });
    }
    try {
      const q = JSON.parse(m[1].trim());
      if (
        typeof q.question === "string" &&
        Array.isArray(q.options) &&
        q.options.length >= 2 &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < q.options.length
      ) {
        segments.push({ type: "mcq", mcq: q });
      }
    } catch {
      // partial or malformed JSON — skip
    }
    last = m.index + m[0].length;
  }

  if (last < content.length) {
    segments.push({ type: "text", text: content.slice(last) });
  }
  return segments;
}

export function hasMcqBlock(content) {
  return !!content && content.includes("```mcq");
}
