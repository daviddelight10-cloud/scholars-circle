// Pure search over the per-page text index built by usePageText.
// Results carry the span range [i0,i1] covering the match so the hit can be
// painted directly on the page's text layer, plus before/match/after snippets.
export async function buildSearchResults(query, getPageIndexData, numPages) {
  const q = query.trim();
  if (!q || !numPages) return [];
  const results = [];
  const ql = q.toLowerCase();
  for (let n = 1; n <= numPages; n++) {
    const idx = await getPageIndexData(n);
    if (!idx || !idx.raw) continue;
    const text = idx.raw;
    const lower = text.toLowerCase();
    let pos = lower.indexOf(ql);
    while (pos !== -1) {
      const start = Math.max(0, pos - 38);
      const end = Math.min(text.length, pos + ql.length + 38);
      const before = (start > 0 ? "…" : "") + text.slice(start, pos);
      const match = text.slice(pos, pos + ql.length);
      const after = text.slice(pos + ql.length, end) + (end < text.length ? "…" : "");
      // Map the char range to covered text-item (span) indices
      let i0 = 0, i1 = 0;
      const starts = idx.itemStart;
      for (let k = 0; k < starts.length; k++) {
        if (starts[k] <= pos) i0 = k;
        if (starts[k] <= pos + ql.length - 1) i1 = k; else break;
      }
      results.push({ page: n, before, match, after, query: q, i0, i1 });
      pos = lower.indexOf(ql, pos + ql.length);
    }
  }
  return results;
}
