// Splits assistant message content into text, interactive-quiz, and
// quiz-error segments. The AI emits quizzes as fenced blocks:
//   ```mcq
//   {"question":"...","options":["A","B","C","D"],"answer":0,"explanation":"..."}
//   ```
// Incomplete/unterminated fences (mid-stream) are silently dropped. A fence
// that IS closed but holds invalid JSON or a malformed question becomes an
// mcq_error segment so the UI can offer a retry.
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
    const closed = m[0].endsWith("```");
    if (closed) {
      const q = validateMcq(m[1]);
      segments.push(q ? { type: "mcq", mcq: q } : { type: "mcq_error" });
    }
    // unterminated fence = still streaming or truncated — drop it
    last = m.index + m[0].length;
  }

  if (last < content.length) {
    segments.push({ type: "text", text: content.slice(last) });
  }
  return segments;
}

function validateMcq(raw) {
  try {
    const q = JSON.parse(raw.trim());
    const question = typeof q.question === "string" ? q.question.trim() : "";
    if (!question) return null;

    const seen = new Set();
    const options = (Array.isArray(q.options) ? q.options : [])
      .map((o) => String(o).trim())
      .filter((o) => {
        if (!o || seen.has(o.toLowerCase())) return false;
        seen.add(o.toLowerCase());
        return true;
      });
    if (options.length < 2) return null;

    const answer = Number(q.answer);
    if (!Number.isInteger(answer) || answer < 0 || answer >= options.length) return null;

    const explanation = typeof q.explanation === "string" ? q.explanation.trim() : "";
    return { question, options, answer, explanation };
  } catch {
    return null;
  }
}

export function hasMcqBlock(content) {
  return !!content && content.includes("```mcq");
}
