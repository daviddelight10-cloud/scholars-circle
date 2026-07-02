import React from "react";

export function SearchResults({ query, subjects, onStart }) {
  const q = query.toLowerCase();
  const subjectHits = (subjects || []).filter((s) => s.label.toLowerCase().includes(q) || s.icon.includes(q));
  const lessonHits = (subjects || []).flatMap((s) =>
    (s.lessons || [])
      .filter((l) => l.title.toLowerCase().includes(q) || l.content.toLowerCase().includes(q))
      .map((l) => ({ ...l, subjectLabel: s.label, subjectId: s.id }))
  );
  const questionHits = (subjects || []).flatMap((s) =>
    (s.questions || [])
      .filter((qn) => qn.q.toLowerCase().includes(q) || qn.options.some((o) => o.toLowerCase().includes(q)))
      .slice(0, 3)
      .map((qn) => ({ ...qn, subjectLabel: s.label, subjectId: s.id }))
  );
  const total = subjectHits.length + lessonHits.length + questionHits.length;
  if (total === 0) return <div className="card"><p className="muted">No results for &ldquo;{query}&rdquo;.</p></div>;

  return (
    <div className="card">
      <h3>Search results for &ldquo;{query}&rdquo; — {total} found</h3>
      {subjectHits.length > 0 && (
        <>
          <p className="muted" style={{ margin: "8px 0 4px" }}><strong>Subjects</strong></p>
          {subjectHits.map((s) => (
            <div key={s.id} className="history-row">
              <span>{s.icon} {s.label}</span>
              <button onClick={() => onStart(s.id)}>Practice</button>
            </div>
          ))}
        </>
      )}
      {lessonHits.length > 0 && (
        <>
          <p className="muted" style={{ margin: "8px 0 4px" }}><strong>Lessons</strong></p>
          {lessonHits.map((l, i) => (
            <div key={i} className="history-row">
              <span><strong>{l.title}</strong> — {l.subjectLabel}</span>
              <span className="muted" style={{ fontSize: 12, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.content.slice(0, 80)}…</span>
            </div>
          ))}
        </>
      )}
      {questionHits.length > 0 && (
        <>
          <p className="muted" style={{ margin: "8px 0 4px" }}><strong>Questions</strong></p>
          {questionHits.map((qn, i) => (
            <div key={i} className="history-row">
              <span>{qn.q.slice(0, 80)}{qn.q.length > 80 ? "…" : ""}</span>
              <span className="muted" style={{ fontSize: 12 }}>{qn.subjectLabel} · {qn.difficulty}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function AchievementsBadges({ badges, stats, history, subjects, mastery }) {
  const earned = badges.filter(b => { try { return b.check(stats, history, subjects, mastery); } catch { return false; } });
  const locked = badges.filter(b => { try { return !b.check(stats, history, subjects, mastery); } catch { return true; } });

  return (
    <div className="card">
      <h2>Achievements & Badges</h2>
      <p className="muted">{earned.length} / {badges.length} earned</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        {earned.map(b => (
          <div key={b.id} className="badge-card earned">
            <span className="badge-icon">{b.icon}</span>
            <strong>{b.label}</strong>
            <span className="muted" style={{ fontSize: 12 }}>{b.desc}</span>
          </div>
        ))}
      </div>
      {locked.length > 0 && (
        <>
          <h3 style={{ opacity: 0.6 }}>Locked</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
            {locked.map(b => (
              <div key={b.id} className="badge-card locked">
                <span className="badge-icon" style={{ filter: "grayscale(1)", opacity: 0.4 }}>{b.icon}</span>
                <strong style={{ opacity: 0.5 }}>{b.label}</strong>
                <span className="muted" style={{ fontSize: 12 }}>{b.desc}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function ConfidenceHeatmap({ history }) {
  if (!history.length) return <p className="muted">No session history yet.</p>;
  const recent = history.slice(-100);
  return (
    <div className="heatmap">
      {recent.map((h, i) => {
        const pct = Math.round((h.score / Math.max(1, h.total)) * 100);
        const color = pct === 100 ? "#FFD700" : pct >= 80 ? "#FFD700" : pct >= 50 ? "#facc15" : "#ff6b6b";
        return (
          <div
            key={i}
            className="heatmap-cell"
            style={{ background: color }}
            title={`${h.subjectLabel}: ${pct}% on ${new Date(h.ts).toLocaleDateString()}`}
          />
        );
      })}
    </div>
  );
}
