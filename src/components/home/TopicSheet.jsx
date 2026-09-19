import { useEffect, useMemo, useRef, useState } from "react";
import { useModalA11y } from "../../hooks/useModalA11y";
import { progressPct } from "./roadmapShared";
import { FileMenu } from "../../features/research-hub/SpaceFileCard";

function Ring({ pct, done }) {
  const C = 2 * Math.PI * 17;
  return (
    <span className={`ts-ring${done ? " done" : ""}`}>
      <svg className="r" viewBox="0 0 40 40" aria-hidden="true">
        <circle className="trk" cx="20" cy="20" r="17" />
        {!done && pct != null && pct > 0 && (
          <circle
            className="arc" cx="20" cy="20" r="17"
            strokeDasharray={C.toFixed(1)}
            strokeDashoffset={(C * (1 - Math.min(pct, 100) / 100)).toFixed(1)}
          />
        )}
      </svg>
      {done ? (
        <span className="sp-ic" aria-hidden="true">✔</span>
      ) : pct != null && pct > 0 ? (
        <span className="num">{pct}</span>
      ) : (
        <span className="sp-ic" aria-hidden="true">📄</span>
      )}
    </span>
  );
}

/**
 * Topic detail sheet — prototype-matched. Mobile: full-height bottom
 * sheet with grabber, drag down to dismiss. Desktop ≥480px: centered
 * rounded card. Sections: header card (chips/title/progress/stats/time),
 * subtopics spine (local done toggle), matched documents (collapsed to 4,
 * ⋯ opens practice sheet), sticky gold "Start studying" CTA.
 */
export default function TopicSheet({
  topic,
  topics,
  progress,
  matches,
  isStartHere,
  resourceVariantsMap,
  mcqProgress,
  onOpenResource,
  onStartStudying,
  onPracticeDoc,
  onClose,
  fileActions,
}) {
  const { modalProps, focusRef } = useModalA11y({
    isOpen: !!topic,
    onClose,
    labelledBy: "ts-title",
  });
  const dragRef = useRef(null);
  const [doneSubs, setDoneSubs] = useState(() => new Set());
  const [showAllDocs, setShowAllDocs] = useState(false);
  const [explain, setExplain] = useState(null);
  const [fillPct, setFillPct] = useState(0);

  const p = progress || null;
  const pct = p ? progressPct(p) : 0;
  const label = p?.label || "Not started";

  // Animate the progress bar after mount
  useEffect(() => {
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => setFillPct(Math.max(pct, 2)))
    );
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  // Drag-to-dismiss on the grab zone
  const onDragStart = (e) => {
    if (e.target.closest("button")) return;
    const el = e.currentTarget.closest(".cs-tsheet");
    if (!el) return;
    dragRef.current = { startY: e.clientY, lastY: e.clientY, lastT: performance.now(), v: 0, dy: 0 };
    el.style.transition = "none";
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      const now = performance.now();
      const dt = now - d.lastT;
      if (dt > 0) d.v = (ev.clientY - d.lastY) / dt;
      d.lastY = ev.clientY;
      d.lastT = now;
      d.dy = Math.max(0, ev.clientY - d.startY);
      el.style.transform = `translateY(${d.dy}px)`;
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      const d = dragRef.current;
      dragRef.current = null;
      if (!d || !el.isConnected) return;
      const threshold = el.offsetHeight * 0.3;
      if (d.dy > threshold || d.v > 0.5) {
        el.style.transition = "transform 0.22s ease-in";
        el.style.transform = "translateY(105%)";
        setTimeout(onClose, 200);
      } else {
        el.style.transition = "transform 0.25s cubic-bezier(0.32,0.72,0,1)";
        el.style.transform = "translateY(0)";
        setTimeout(() => { el.style.transition = ""; el.style.transform = ""; }, 260);
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { once: true });
    document.addEventListener("pointercancel", onUp, { once: true });
  };

  const docs = useMemo(
    () => (matches || [])
      .filter((m) => m?.resource)
      .slice()
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)),
    [matches]
  );

  if (!topic) return null;

  const subs = topic.subtopics || [];
  const mastered = label === "Mastered";
  const stateCls = mastered ? "mastered" : pct > 0 ? "learning" : "new";
  const stateText = mastered ? "Mastered" : pct > 0 ? "Learning" : "New";

  // Estimated study time — 5 min per subtopic + 10 min per doc
  const estMinutes = subs.length * 5 + docs.length * 10;
  const estLabel = estMinutes >= 60
    ? `${Math.round(estMinutes / 60)} hour${Math.round(estMinutes / 60) > 1 ? "s" : ""}`
    : `${estMinutes} min`;

  const nextIdx = subs.findIndex((_, i) => !doneSubs.has(i));
  const doneCount = doneSubs.size;
  const prereqTopics = (topic.prerequisiteIds || [])
    .map((pid) => topics.find((t) => t.id === pid))
    .filter(Boolean);

  const visibleDocs = showAllDocs ? docs : docs.slice(0, 4);

  const toggleSub = (i) => {
    setDoneSubs((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  const EXPLAIN = {
    stability: "is how many days your memory of these items lasts before recall drops to 90%.",
    items: "is the total number of MCQ questions available across the matched documents for this topic.",
    mastered: "is how many of those questions you've answered correctly enough times to be considered learned.",
    retrievability: "is the estimated chance you'd recall a random item correctly right now.",
  };

  return (
    <div className="cs-sheet-backdrop cs-tsheet-backdrop" onClick={onClose}>
      <div
        {...modalProps}
        ref={focusRef}
        className="cs-tsheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab zone — drag down to dismiss */}
        <div
          className="cs-sheet-grab"
          onPointerDown={onDragStart}
          role="separator"
          aria-label="Drag down to close"
        >
          <div className="cs-sheet-handle" />
        </div>

        <div className="cs-tsheet-scroll">
          <div className="cs-tsheet-stack">
            {/* ── Header card ─────────────────────────────────── */}
            <article className="ts-card">
              <div className="ts-top">
                <div className="ts-chips">
                  {topic.displayOrder != null && (
                    <span className="ts-chip" style={{ background: "transparent", color: "#5E6470", fontFamily: "'JetBrains Mono', monospace", padding: 0 }}>
                      #{topic.displayOrder}
                    </span>
                  )}
                  {isStartHere && (
                    <span className="ts-chip start"><span className="sp-ic" aria-hidden="true">⚑</span>Start here</span>
                  )}
                  {topic.source === "outline" && (
                    <span className="ts-chip kind">Outline</span>
                  )}
                  {topic.status === "disputed" && (
                    <span className="ts-chip disputed">Disputed</span>
                  )}
                </div>
                <button className="ts-close" type="button" aria-label="Close" onClick={onClose}>✕</button>
              </div>

              <h1 className="ts-title" id="ts-title">{topic.title}</h1>
              {topic.description && <p className="ts-lede">{topic.description}</p>}

              <div className="ts-progress">
                <div className="ts-progress-head">
                  <span className="ts-progress-lab">Progress</span>
                  <span className="ts-progress-val">
                    <span className={`ts-state ${stateCls}`}>{stateText}</span>
                    <span className={`ts-pct${mastered ? " mastered" : ""}`}>{pct}%</span>
                  </span>
                </div>
                <div
                  className="ts-track" role="progressbar"
                  aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}
                  aria-label="Topic progress"
                >
                  <div className={`ts-fill${mastered ? " mastered" : ""}`} style={{ width: `${fillPct}%` }} />
                </div>
              </div>

              {(p?.totalItems > 0 || p?.masteredCount > 0 || p?.avgStability != null) && (
                <>
                  <div className="ts-stats" role="group" aria-label="Topic stats">
                    {p?.totalItems > 0 && (
                      <button
                        className="ts-stat" type="button"
                        aria-expanded={explain === "items"}
                        onClick={() => setExplain(explain === "items" ? null : "items")}
                      >
                        <span className="v">{p.totalItems}</span>
                        <span className="l">Items <span className="sp-ic" aria-hidden="true">ⓘ</span></span>
                      </button>
                    )}
                    {(p?.masteredCount > 0 || p?.totalItems > 0) && (
                      <button
                        className="ts-stat" type="button"
                        aria-expanded={explain === "mastered"}
                        onClick={() => setExplain(explain === "mastered" ? null : "mastered")}
                      >
                        <span className="v ok">{p.masteredCount || 0}</span>
                        <span className="l">Mastered <span className="sp-ic" aria-hidden="true">ⓘ</span></span>
                      </button>
                    )}
                    {p?.avgStability != null && (
                      <button
                        className="ts-stat" type="button"
                        aria-expanded={explain === "stability"}
                        onClick={() => setExplain(explain === "stability" ? null : "stability")}
                      >
                        <span className="v">{Number(p.avgStability).toFixed(2)}<small>days</small></span>
                        <span className="l">Stability <span className="sp-ic" aria-hidden="true">ⓘ</span></span>
                      </button>
                    )}
                    {p?.avgRetrievability != null && (
                      <button
                        className="ts-stat" type="button"
                        aria-expanded={explain === "retrievability"}
                        onClick={() => setExplain(explain === "retrievability" ? null : "retrievability")}
                      >
                        <span className="v">{Math.round(p.avgRetrievability * 100)}<small>%</small></span>
                        <span className="l">Recall <span className="sp-ic" aria-hidden="true">ⓘ</span></span>
                      </button>
                    )}
                  </div>
                  {explain && (
                    <p className="ts-explain">
                      <b>{{ items: "Items", mastered: "Mastered", stability: "Stability", retrievability: "Recall" }[explain]}</b> {EXPLAIN[explain]}
                    </p>
                  )}
                </>
              )}

              <p className="ts-time">
                <span className="sp-ic" aria-hidden="true">⏱</span>
                <span>Estimated study time <b>{estLabel}</b></span>
              </p>
            </article>

            {/* ── Subtopics spine ─────────────────────────────── */}
            {subs.length > 0 && (
              <section className="ts-card" aria-labelledby="ts-h-subs">
                <div className="ts-sec-head">
                  <h2 className="ts-h2" id="ts-h-subs">Subtopics</h2>
                  <span className="n">{doneCount} of {subs.length} done</span>
                </div>
                <ol className="ts-subs">
                  {subs.map((s, i) => {
                    const done = doneSubs.has(i);
                    const isNext = i === nextIdx;
                    return (
                      <li key={i} className={`${done ? "done" : ""}${isNext ? " next" : ""}`}>
                        <button
                          className="ts-subrow" type="button"
                          aria-pressed={done}
                          onClick={() => toggleSub(i)}
                        >
                          <span className="ts-node">{done ? <span className="sp-ic" aria-hidden="true">✔</span> : i + 1}</span>
                          <span className="t">{s}</span>
                          {isNext ? <span className="ts-hint">Up next</span> : <span />}
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}

            {/* ── Matched documents ───────────────────────────── */}
            {docs.length > 0 && (
              <section className="ts-docs" aria-labelledby="ts-h-docs">
                <div className="ts-sec-head">
                  <h2 className="ts-h2" id="ts-h-docs">Documents</h2>
                  <span className="n">{docs.length} source{docs.length === 1 ? "" : "s"}, best match first</span>
                </div>
                <ul className="ts-doclist">
                  {visibleDocs.map((m, i) => {
                    const r = m.resource;
                    const conf = m.confidence != null ? Math.round(m.confidence * 100) : null;
                    const variants = resourceVariantsMap?.get(m.resourceId) || null;
                    const prog = variants?.mcq && mcqProgress ? mcqProgress[variants.mcq.id] : null;
                    const docPct = prog
                      ? (prog.learnedPct ?? (prog.total > 0 ? Math.min(100, Math.round(((prog.mastered || 0) / prog.total) * 100)) : null))
                      : null;
                    const caps = [
                      variants?.mcq && "✎",
                      variants?.flashcard && "🎴",
                      variants?.summary && "📝",
                    ].filter(Boolean);
                    const full = fileActions?.resolveFile?.(m) || r;
                    return (
                      <li key={r.id || i} className="ts-doc">
                        <button
                          className="ts-doc-main" type="button"
                          onClick={() => (onPracticeDoc ? onPracticeDoc(m) : r.shareToken && onOpenResource?.(r.shareToken))}
                        >
                          <Ring pct={docPct} done={docPct === 100} />
                          <span style={{ minWidth: 0 }}>
                            <span className="ts-ft">{r.title || "Untitled"}</span>
                            <span className="ts-fm">
                              {conf != null && <span>{conf}% match</span>}
                              {conf != null && <span className="sep">·</span>}
                              <span className="views"><span className="sp-ic" aria-hidden="true">👁</span>{r.viewCount || 0}</span>
                              {caps.length > 0 && (
                                <span className="fi">{caps.map((c, j) => <span className="sp-ic" key={j}>{c}</span>)}</span>
                              )}
                            </span>
                          </span>
                        </button>
                        {fileActions ? (
                          <FileMenu
                            file={full}
                            isBookmarked={fileActions.bookmarkedIds?.has(full.id)}
                            bookmarkBusy={fileActions.bookmarkBusyId === full.id}
                            onToggleBookmark={fileActions.onToggleBookmark}
                            onShare={fileActions.onShare}
                            onDelete={fileActions.onDeleteResource}
                            canDelete={fileActions.canDeleteFile?.(full)}
                            onRename={fileActions.onRenameResource}
                            kebabClass="ts-doc-kebab"
                          />
                        ) : onPracticeDoc ? (
                          <button
                            className="ts-doc-kebab" type="button"
                            aria-label={`More actions for ${r.title || "document"}`}
                            onClick={() => onPracticeDoc(m)}
                          >
                            ⋯
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                {docs.length > 4 && (
                  <button
                    className="ts-more" type="button"
                    aria-expanded={showAllDocs}
                    onClick={() => setShowAllDocs((v) => !v)}
                  >
                    <span>{showAllDocs ? "Show fewer" : `Show all ${docs.length} documents`}</span>
                    <span className="sp-ic" aria-hidden="true">⌄</span>
                  </button>
                )}
              </section>
            )}

            {/* ── Prerequisites ───────────────────────────────── */}
            {prereqTopics.length > 0 && (
              <section className="ts-card" aria-labelledby="ts-h-prereq">
                <div className="ts-sec-head">
                  <h2 className="ts-h2" id="ts-h-prereq">Prerequisites</h2>
                </div>
                <ul className="ts-doclist" style={{ marginTop: 10 }}>
                  {prereqTopics.map((pt) => (
                    <li key={pt.id} className="ts-doc" style={{ padding: "10px 12px" }}>
                      <span className="ts-ft" style={{ fontSize: 13 }}>{pt.title}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        {/* ── Sticky action ───────────────────────────────────── */}
        {onStartStudying && (
          <div className="ts-action">
            <button
              className="ts-go" type="button"
              onClick={() => { onClose(); onStartStudying(topic); }}
            >
              <span className="sp-ic" aria-hidden="true">⚡</span>
              Start studying
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
