import { useMemo, useState } from "react";
import { FdScreen, FdSheet } from "../../features/feed/feedUi.jsx";
import { effectiveLabel, effectivePct } from "./roadmapShared";
import { mcqRingPct } from "../../lib/researchUtils";
import { FileMenu } from "../../features/research-hub/SpaceFileCard";

const EXPLAIN = {
  items: "is the total number of practice questions available across the matched documents for this topic.",
  mastered: "is how many of those questions you've answered correctly enough times to be considered learned.",
  stability: "is how many days your memory of these items lasts before recall drops to 90%.",
  retrievability: "is the estimated chance you'd recall a random item correctly right now.",
};

function BigRing({ pct, done }) {
  const r = 30;
  const C = 2 * Math.PI * r;
  return (
    <span className="tp-bigring" aria-hidden="true">
      <svg viewBox="0 0 72 72">
        <circle className="trk" cx="36" cy="36" r={r} />
        <circle
          className={`arc${done ? " done" : ""}`}
          cx="36" cy="36" r={r}
          strokeDasharray={C.toFixed(1)}
          strokeDashoffset={(C * (1 - Math.min(pct, 100) / 100)).toFixed(1)}
        />
      </svg>
      {done ? <span className="n">✔</span> : <span className="n">{pct}%</span>}
    </span>
  );
}

function DocRing({ pct, done }) {
  const C = 2 * Math.PI * 17;
  return (
    <span className="ts-ring" aria-hidden="true">
      <svg className="r" viewBox="0 0 40 40">
        <circle className="trk" cx="20" cy="20" r="17" />
        {!done && pct != null && pct > 0 && (
          <circle className="arc" cx="20" cy="20" r="17"
            strokeDasharray={C.toFixed(1)}
            strokeDashoffset={(C * (1 - Math.min(pct, 100) / 100)).toFixed(1)} />
        )}
      </svg>
      {done ? <span className="sp-ic">✔</span>
        : pct != null && pct > 0 ? <span className="num">{pct}</span>
        : <span className="sp-ic">📄</span>}
    </span>
  );
}

/**
 * Full-screen topic page. Replaces the old bottom sheet: pinned header with
 * back + topic menu, hero progress, Learn / Documents / Progress tabs,
 * sticky "Start studying" CTA.
 */
export default function TopicPage({
  topic,
  topics,
  progress,
  matches,
  isStartHere,
  onNavigate,
  courseCode,
  resourceVariantsMap,
  mcqProgress,
  fileActions,
  onOpenResource,
  onStartStudying,
  onPracticeDoc,
  onEdit,
  onDelete,
  onToggleDone,
  onToggleSub,
  onPlaceDoc,
  onUnassign,
  onClose,
}) {
  const [tab, setTab] = useState("learn");
  const [menuOpen, setMenuOpen] = useState(false);
  const [docMenu, setDocMenu] = useState(null); // match with open action sheet
  const [docSearch, setDocSearch] = useState("");
  const [explain, setExplain] = useState(null);

  const p = progress || null;
  const label = effectiveLabel(topic, p);
  const pct = effectivePct(topic, p);
  const done = topic?.manuallyDone || label === "Mastered";
  const stateCls = done ? "mastered" : pct > 0 ? "learning" : "new";

  const subs = topic?.subtopics || [];
  const doneSubs = useMemo(() => new Set(topic?.doneSubs || []), [topic]);
  const doneCount = subs.filter((s) => doneSubs.has(s)).length;

  const docs = useMemo(
    () => (matches || []).filter((m) => m?.resource).slice()
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0)),
    [matches]
  );
  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((m) => (m.resource?.title || "").toLowerCase().includes(q));
  }, [docs, docSearch]);

  const prereqTopics = (topic?.prerequisiteIds || [])
    .map((pid) => topics.find((t) => t.id === pid))
    .filter(Boolean);

  const topicIdx = topics.findIndex((t) => t.id === topic?.id);
  const prevTopic = topicIdx > 0 ? topics[topicIdx - 1] : null;
  const nextTopic = topicIdx >= 0 && topicIdx < topics.length - 1 ? topics[topicIdx + 1] : null;

  const estMinutes = subs.length * 5 + docs.length * 10;
  const estLabel = estMinutes >= 60
    ? `${Math.round(estMinutes / 60)} hour${Math.round(estMinutes / 60) > 1 ? "s" : ""}`
    : `${estMinutes} min`;

  if (!topic) return null;

  const docActionSheet = docMenu && (
    <FdSheet title={docMenu.resource?.title || "Document"} onClose={() => setDocMenu(null)}>
      <div className="fd-sheet-actions">
        <button className="fd-sheet-action" onClick={() => {
          const m = docMenu; setDocMenu(null);
          onPracticeDoc ? onPracticeDoc(m) : m.resource?.shareToken && onOpenResource?.(m.resource.shareToken);
        }}>▶ Open / practice</button>
        <button className="fd-sheet-action" onClick={() => {
          const m = docMenu; setDocMenu(null);
          onPlaceDoc?.({ mode: "doc", resource: m.resource });
        }}>⇄ Move to another topic</button>
        <button className="fd-sheet-action danger" onClick={() => {
          const m = docMenu; setDocMenu(null);
          onUnassign?.(m);
        }}>✕ Remove from this topic</button>
      </div>
    </FdSheet>
  );

  const menuSheet = menuOpen && (
    <FdSheet title={topic.title} onClose={() => setMenuOpen(false)}>
      <div className="fd-sheet-actions">
        <button className="fd-sheet-action" onClick={() => { setMenuOpen(false); onToggleDone?.(topic); }}>
          {topic.manuallyDone ? "↩ Unmark as done" : "✔ Mark as done"}
        </button>
        <button className="fd-sheet-action" onClick={() => { setMenuOpen(false); onEdit?.(topic); }}>✎ Edit topic</button>
        <button className="fd-sheet-action danger" onClick={() => { setMenuOpen(false); onDelete?.(topic); }}>🗑 Delete topic</button>
      </div>
    </FdSheet>
  );

  return (
    <FdScreen
      className="tp-screen"
      title={topic.title}
      meta={`${courseCode}${topic.displayOrder != null ? ` · Topic ${topic.displayOrder + 1}` : ""}`}
      onBack={onClose}
      onBackLabel="Back to roadmap"
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button className="fd-icon-btn" aria-label="Edit topic" onClick={() => onEdit?.(topic)}>✎</button>
          <button className="fd-icon-btn" aria-label="Topic menu" onClick={() => setMenuOpen(true)}>⋯</button>
        </div>
      }
      footer={
        onStartStudying && (
          <button className="tp-go" type="button" onClick={() => { onClose(); onStartStudying(topic); }}>
            <span aria-hidden="true">⚡</span> {pct > 0 || done ? "Continue studying" : "Start studying"}
          </button>
        )
      }
    >
      <div className="fd-screen-scroll">
      {/* Hero */}
      <div className="tp-hero">
        <BigRing pct={pct} done={done} />
        <div className="tp-hero-main">
          <div className="tp-chips">
            <span className={`ts-state ${stateCls}`}>{topic.manuallyDone ? "Done" : label}</span>
            {isStartHere && <span className="ts-chip start">⚑ Start here</span>}
            {topic.source === "outline" && <span className="ts-chip kind">Outline</span>}
            {topic.source === "manual" && <span className="ts-chip kind">Added by you</span>}
            {topic.status === "disputed" && <span className="ts-chip disputed">Disputed</span>}
          </div>
          <div className="tp-hero-meta">
            {docs.length} doc{docs.length === 1 ? "" : "s"} · {doneCount}/{subs.length} subtopics · ~{estLabel}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tp-seg fd-seg" role="tablist" aria-label="Topic sections">
        {[["learn", "Learn"], ["docs", `Docs${docs.length ? ` ${docs.length}` : ""}`], ["progress", "Progress"]].map(([id, t]) => (
          <button key={id} role="tab" aria-selected={tab === id}
            className={`fd-tab${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>{t}</button>
        ))}
      </div>

      {tab === "learn" && (
        <div className="tp-tabbody">
          {topic.description && <p className="tp-lede">{topic.description}</p>}

          {subs.length > 0 && (
            <section className="ts-card" aria-labelledby="tp-h-subs">
              <div className="ts-sec-head">
                <h2 className="ts-h2" id="tp-h-subs">Subtopics</h2>
                <span className="n">{doneCount} of {subs.length} done</span>
              </div>
              <ol className="ts-subs">
                {subs.map((s, i) => {
                  const subDone = doneSubs.has(s);
                  const isNext = !subDone && subs.slice(0, i).every((x, j) => j === i || doneSubs.has(x));
                  return (
                    <li key={`${s}-${i}`} className={`${subDone ? "done" : ""}${isNext ? " next" : ""}`}>
                      <button className="ts-subrow" type="button" aria-pressed={subDone}
                        onClick={() => onToggleSub?.(topic, s)}>
                        <span className="ts-node">{subDone ? <span className="sp-ic">✔</span> : i + 1}</span>
                        <span className="t">{s}</span>
                        {isNext ? <span className="ts-hint">Up next</span> : <span />}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          )}

          {prereqTopics.length > 0 && (
            <section className="ts-card" aria-labelledby="tp-h-prereq">
              <div className="ts-sec-head"><h2 className="ts-h2" id="tp-h-prereq">Prerequisites</h2></div>
              <div className="tp-prereqs">
                {prereqTopics.map((pt) => (
                  <button key={pt.id} className="tp-prereq" onClick={() => onNavigate?.(pt.id)}>
                    {pt.title}<span aria-hidden="true"> ›</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {!topic.description && subs.length === 0 && prereqTopics.length === 0 && (
            <div className="fd-empty">
              <div className="fd-empty-icon">📝</div>
              <div className="fd-empty-title">Nothing here yet</div>
              <div className="fd-empty-sub">Add subtopics and a description from the ✎ edit button.</div>
            </div>
          )}
        </div>
      )}

      {tab === "docs" && (
        <div className="tp-tabbody">
          <button className="tp-adddoc" onClick={() => onPlaceDoc?.({ mode: "topic", topic })}>
            ＋ Add document to this topic
          </button>
          {docs.length > 6 && (
            <input className="tp-search" placeholder="Search documents…" value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)} aria-label="Search documents" />
          )}
          {docs.length === 0 && (
            <div className="fd-empty">
              <div className="fd-empty-icon">📄</div>
              <div className="fd-empty-title">No documents matched</div>
              <div className="fd-empty-sub">Use “Add document” to place files here manually, or run Match Docs on the roadmap.</div>
            </div>
          )}
          <ul className="ts-doclist">
            {filteredDocs.map((m, i) => {
              const r = m.resource;
              const conf = m.confidence != null ? Math.round(m.confidence * 100) : null;
              const variants = resourceVariantsMap?.get(m.resourceId) || null;
              const prog = variants?.mcq && mcqProgress ? mcqProgress[variants.mcq.id] : null;
              const docPct = prog ? mcqRingPct(prog) : null;
              const caps = [variants?.mcq && "✎", variants?.flashcard && "🎴", variants?.summary && "📝"].filter(Boolean);
              const full = fileActions?.resolveFile?.(m) || r;
              return (
                <li key={r.id || i} className="ts-doc">
                  <button className="ts-doc-main" type="button"
                    onClick={() => (onPracticeDoc ? onPracticeDoc(m) : r.shareToken && onOpenResource?.(r.shareToken))}>
                    <DocRing pct={docPct} done={docPct === 100} />
                    <span style={{ minWidth: 0 }}>
                      <span className="ts-ft">{r.title || "Untitled"}</span>
                      <span className="ts-fm">
                        {m.matchSource === "manual"
                          ? <span className="tp-manual">Placed by you</span>
                          : conf != null && <span>{conf}% match</span>}
                        <span className="sep">·</span>
                        <span className="views"><span className="sp-ic">👁</span>{r.viewCount || 0}</span>
                        {caps.length > 0 && <span className="fi">{caps.map((c, j) => <span className="sp-ic" key={j}>{c}</span>)}</span>}
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
                      extraItems={[
                        { label: "⇄ Move to topic", onClick: () => onPlaceDoc?.({ mode: "doc", resource: r }) },
                        { label: "✕ Remove from topic", onClick: () => onUnassign?.(m), danger: true },
                      ]}
                      kebabClass="ts-doc-kebab"
                    />
                  ) : (
                    <button className="ts-doc-kebab" type="button"
                      aria-label={`More actions for ${r.title || "document"}`}
                      onClick={() => setDocMenu(m)}>⋯</button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {tab === "progress" && (
        <div className="tp-tabbody">
          <section className="ts-card">
            <div className="ts-stats" role="group" aria-label="Topic stats">
              <button className="ts-stat" type="button" aria-expanded={explain === "items"}
                onClick={() => setExplain(explain === "items" ? null : "items")}>
                <span className="v">{p?.totalItems || 0}</span>
                <span className="l">Items <span className="sp-ic">ⓘ</span></span>
              </button>
              <button className="ts-stat" type="button" aria-expanded={explain === "mastered"}
                onClick={() => setExplain(explain === "mastered" ? null : "mastered")}>
                <span className="v ok">{p?.masteredCount || 0}</span>
                <span className="l">Mastered <span className="sp-ic">ⓘ</span></span>
              </button>
              {p?.avgStability != null && (
                <button className="ts-stat" type="button" aria-expanded={explain === "stability"}
                  onClick={() => setExplain(explain === "stability" ? null : "stability")}>
                  <span className="v">{Number(p.avgStability).toFixed(2)}<small>days</small></span>
                  <span className="l">Stability <span className="sp-ic">ⓘ</span></span>
                </button>
              )}
              {p?.avgRetrievability != null && (
                <button className="ts-stat" type="button" aria-expanded={explain === "retrievability"}
                  onClick={() => setExplain(explain === "retrievability" ? null : "retrievability")}>
                  <span className="v">{Math.round(p.avgRetrievability * 100)}<small>%</small></span>
                  <span className="l">Recall <span className="sp-ic">ⓘ</span></span>
                </button>
              )}
            </div>
            {explain && (
              <p className="ts-explain">
                <b>{{ items: "Items", mastered: "Mastered", stability: "Stability", retrievability: "Recall" }[explain]}</b> {EXPLAIN[explain]}
              </p>
            )}
          </section>

          <section className="ts-card">
            <div className="ts-sec-head"><h2 className="ts-h2">Mark as done</h2></div>
            <p className="tp-note">
              Studied this topic outside the app? Mark it done — it shows as complete on your roadmap.
              Your practice stats stay unchanged.
            </p>
            <button
              className={`tp-done-btn${topic.manuallyDone ? " on" : ""}`}
              onClick={() => onToggleDone?.(topic)}
              aria-pressed={!!topic.manuallyDone}
            >
              {topic.manuallyDone ? "✔ Done — tap to undo" : "Mark this topic as done"}
            </button>
          </section>

          <p className="tp-time">
            <span className="sp-ic" aria-hidden="true">⏱</span>
            <span>Estimated study time <b>{estLabel}</b></span>
          </p>
        </div>
      )}

      {/* Prev / next topic — bottom of page, thumb-reachable */}
      {(prevTopic || nextTopic) && (
        <div className="tp-prevnext">
          {prevTopic ? (
            <button className="tp-pn" onClick={() => onNavigate?.(prevTopic.id)} aria-label={`Previous topic: ${prevTopic.title}`}>
              <span className="ar" aria-hidden="true">‹</span>
              <span className="t">{prevTopic.title}</span>
            </button>
          ) : <span aria-hidden="true" />}
          {nextTopic ? (
            <button className="tp-pn next" onClick={() => onNavigate?.(nextTopic.id)} aria-label={`Next topic: ${nextTopic.title}`}>
              <span className="t">{nextTopic.title}</span>
              <span className="ar" aria-hidden="true">›</span>
            </button>
          ) : <span aria-hidden="true" />}
        </div>
      )}
      </div>

      {menuSheet}
      {docActionSheet}
    </FdScreen>
  );
}
