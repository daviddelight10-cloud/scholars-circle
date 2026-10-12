/**
 * Incremental parser for a streamed JSON array of objects.
 *
 * `callAIStream`'s onToken hands the accumulated raw text on every token, so
 * the parser keeps a consumed-index and only scans forward — safe to push the
 * same text repeatedly. Each completed top-level `{...}` object is emitted via
 * onItem exactly once. Tolerates leading prose / ```json fences (everything
 * outside top-level braces is ignored), braces inside strings, escaped quotes,
 * nested objects, and truncated tails (an unterminated object is never
 * emitted).
 */
export function createArrayStreamParser(onItem) {
  let consumed = 0; // index into the accumulated text already scanned
  let depth = 0; // brace depth at top level of the current object
  let objStart = -1; // index where the current top-level object began
  let inStr = false;
  let esc = false;

  return {
    push(fullText) {
      const n = fullText.length;
      for (; consumed < n; consumed++) {
        const ch = fullText[consumed];
        if (inStr) {
          if (esc) esc = false;
          else if (ch === "\\") esc = true;
          else if (ch === '"') inStr = false;
          continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === "{") {
          if (depth === 0) objStart = consumed;
          depth++;
          continue;
        }
        if (ch === "}") {
          if (depth > 0) {
            depth--;
            if (depth === 0 && objStart >= 0) {
              const slice = fullText.slice(objStart, consumed + 1);
              objStart = -1;
              try {
                onItem(JSON.parse(slice));
              } catch { /* malformed object — skip it */ }
            }
          }
          continue;
        }
        // everything else (prose, [ ] , whitespace, fences) is ignored
      }
    },
  };
}
