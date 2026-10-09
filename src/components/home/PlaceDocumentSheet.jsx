import { useMemo, useState } from "react";
import { FdSheet } from "../../features/feed/feedUi.jsx";
import { assignDocument, unassignDocument } from "../../lib/skeletonGenerator";

const DOC_ICONS = {
  pdf: "📄", docx: "📝", doc: "📝", pptx: "📊", image: "🖼️",
  txt: "📃", note: "📃", tutorial_question: "❓",
};

/**
 * Manual document placement sheet.
 *  mode "doc"   — given `resource`, check which topics contain it (multi-assign).
 *  mode "topic" — given `topic`, check which folder documents belong to it.
 * `matches` = current DocumentTopicMatch rows for the course (caller refreshes
 * after save via onSaved).
 */
export default function PlaceDocumentSheet({ mode, resource, topic, topics, matches, folderResources, onSaved, onClose }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // mode "doc": set of topicIds currently containing resource
  // mode "topic": set of resourceIds currently inside topic
  const initial = useMemo(() => {
    const s = new Set();
    if (mode === "doc" && resource) {
      for (const m of matches) if (m.resourceId === resource.id) s.add(m.topicId);
    } else if (mode === "topic" && topic) {
      for (const m of matches) if (m.topicId === topic.id) s.add(m.resourceId);
    }
    return s;
  }, [mode, resource, topic, matches]);

  const [checked, setChecked] = useState(() => new Set(initial));

  const toggle = (id) => setChecked((prev) => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  // Rows shown: topics (doc mode) or placeable resources (topic mode)
  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (mode === "doc") {
      return topics
        .filter((t) => !query || t.title.toLowerCase().includes(query))
        .map((t) => ({ id: t.id, title: t.title, sub: `${t.displayOrder != null ? `#${t.displayOrder + 1}` : ""}` }));
    }
    return (folderResources || [])
      .filter((r) => !query || (r.title || "").toLowerCase().includes(query))
      .map((r) => ({ id: r.id, title: r.title || "Untitled", sub: DOC_ICONS[r.contentType] ? `${DOC_ICONS[r.contentType]} ${r.contentType}` : r.contentType }));
  }, [mode, q, topics, folderResources]);

  const dirty = useMemo(() => {
    if (checked.size !== initial.size) return true;
    for (const id of checked) if (!initial.has(id)) return true;
    return false;
  }, [checked, initial]);

  const save = async () => {
    if (!dirty || busy) return;
    setBusy(true);
    setError("");
    try {
      const calls = [];
      if (mode === "doc") {
        for (const tid of checked) if (!initial.has(tid)) calls.push(assignDocument(resource.id, tid));
        for (const m of matches) {
          if (m.resourceId === resource.id && !checked.has(m.topicId)) calls.push(unassignDocument(m.id));
        }
      } else {
        for (const rid of checked) if (!initial.has(rid)) calls.push(assignDocument(rid, topic.id));
        for (const m of matches) {
          if (m.topicId === topic.id && !checked.has(m.resourceId)) calls.push(unassignDocument(m.id));
        }
      }
      await Promise.all(calls);
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || "Couldn't save placement");
    } finally {
      setBusy(false);
    }
  };

  const heading = mode === "doc"
    ? `Place “${resource?.title || "document"}” in…`
    : `Add documents to “${topic?.title || "topic"}”`;

  return (
    <FdSheet
      title={heading}
      onClose={onClose}
      footer={
        <button className="tp-save" disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : "Save placement"}
        </button>
      }
    >
      <input
        className="tp-search"
        placeholder={mode === "doc" ? "Search topics…" : "Search documents…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label={mode === "doc" ? "Search topics" : "Search documents"}
      />
      <div className="tp-picklist" role="group" aria-label={heading}>
        {rows.length === 0 && (
          <div className="fd-empty-inline">Nothing matches “{q}”.</div>
        )}
        {rows.map((row) => (
          <label key={row.id} className={`tp-pick${checked.has(row.id) ? " on" : ""}`}>
            <input
              type="checkbox"
              checked={checked.has(row.id)}
              onChange={() => toggle(row.id)}
            />
            <span className="tp-pick-t">{row.title}</span>
            {row.sub && <span className="tp-pick-s">{row.sub}</span>}
          </label>
        ))}
      </div>
      {error && <div className="tpe-error">{error}</div>}
    </FdSheet>
  );
}
