import { useMemo, useState } from "react";
import { FdSheet } from "../../features/feed/feedUi.jsx";
import { updateTopic, createTopic } from "../../lib/skeletonGenerator";

/**
 * Topic editor — title, description, subtopics and prerequisites.
 * `topic` null = create mode (new topic appended to the roadmap).
 */
export default function TopicEditSheet({ topic, topics, courseCode, onSaved, onClose }) {
  const isNew = !topic;
  const [title, setTitle] = useState(topic?.title || "");
  const [description, setDescription] = useState(topic?.description || "");
  const [subs, setSubs] = useState(() => (topic?.subtopics || []).map(String));
  const [newSub, setNewSub] = useState("");
  const [prereqs, setPrereqs] = useState(() => new Set(topic?.prerequisiteIds || []));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const others = useMemo(() => topics.filter((t) => t.id !== topic?.id), [topics, topic]);

  const addSub = () => {
    const s = newSub.trim();
    if (!s) return;
    if (subs.some((x) => x.toLowerCase() === s.toLowerCase())) { setNewSub(""); return; }
    setSubs((p) => [...p, s]);
    setNewSub("");
  };
  const moveSub = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= subs.length) return;
    setSubs((p) => { const n = [...p]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  };
  const togglePrereq = (id) => {
    setPrereqs((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const save = async () => {
    const t = title.trim();
    if (!t || saving) return;
    setSaving(true);
    setError("");
    try {
      const cleanSubs = subs.map((s) => s.trim()).filter(Boolean);
      if (isNew) {
        const updated = await createTopic(courseCode, t, topics.length, {
          description: description.trim() || undefined,
          subtopics: cleanSubs,
        });
        onSaved?.(updated, "created");
      } else {
        const updated = await updateTopic(topic.id, {
          title: t,
          description: description.trim(),
          subtopics: cleanSubs,
          prerequisiteIds: [...prereqs],
        });
        onSaved?.(updated, "updated");
      }
      onClose();
    } catch (e) {
      setError(e.message || "Couldn't save topic");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FdSheet
      title={isNew ? "Add topic" : "Edit topic"}
      onClose={onClose}
      footer={
        <button className="tp-save" disabled={saving || !title.trim()} onClick={save}>
          {saving ? "Saving…" : isNew ? "Add topic" : "Save changes"}
        </button>
      }
    >
      <label className="tpe-label">Title</label>
      <input className="tpe-input" value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Cardiac electrophysiology" autoFocus={isNew} maxLength={120} />

      <label className="tpe-label">Description <span className="tpe-opt">optional</span></label>
      <textarea className="tpe-input" rows={2} value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What this topic covers…" maxLength={400} />

      <label className="tpe-label">Subtopics <span className="tpe-opt">{subs.length} added</span></label>
      <div className="tpe-subs">
        {subs.map((s, i) => (
          <div className="tpe-sub" key={`${s}-${i}`}>
            <span className="tpe-sub-t">{s}</span>
            <button aria-label="Move up" disabled={i === 0} onClick={() => moveSub(i, -1)}>↑</button>
            <button aria-label="Move down" disabled={i === subs.length - 1} onClick={() => moveSub(i, 1)}>↓</button>
            <button aria-label={`Remove ${s}`} className="del" onClick={() => setSubs((p) => p.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
        <div className="tpe-sub-add">
          <input className="tpe-input" value={newSub} onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSub(); } }}
            placeholder="Add a subtopic…" maxLength={120} />
          <button onClick={addSub} disabled={!newSub.trim()} aria-label="Add subtopic">＋</button>
        </div>
      </div>

      {!isNew && others.length > 0 && (
        <>
          <label className="tpe-label">Prerequisites <span className="tpe-opt">students should know these first</span></label>
          <div className="tpe-prereqs">
            {others.map((t) => (
              <button key={t.id} type="button"
                className={`tpe-chip${prereqs.has(t.id) ? " on" : ""}`}
                aria-pressed={prereqs.has(t.id)}
                onClick={() => togglePrereq(t.id)}>
                {t.title}
              </button>
            ))}
          </div>
        </>
      )}

      {error && <div className="tpe-error">{error}</div>}
    </FdSheet>
  );
}
