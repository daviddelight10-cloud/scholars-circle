import { useState } from "react";
import { FONTS } from "../../lib/theme";

export const D = {
  ink: "#0A0D13",
  ink2: "#10141C",
  panel: "rgba(255,255,255,0.045)",
  panel2: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.09)",
  gold: "#F5A623",
  blue: "#4F8EF7",
  green: "#3DD68C",
  coral: "#FF5470",
  textHi: "#F3F5F8",
  textMid: "#9199A8",
  textLow: "#5D6472",
};

export const PROGRESS_COLORS = {
  "Not started": D.textLow,
  "New": D.coral,
  "Learning": D.gold,
  "Reviewing": D.blue,
  "Mastered": D.green,
};

export const PROGRESS_BG = {
  "Not started": "rgba(86,94,110,0.15)",
  "New": "rgba(255,84,112,0.12)",
  "Learning": "rgba(245,166,35,0.12)",
  "Reviewing": "rgba(79,142,247,0.12)",
  "Mastered": "rgba(61,214,140,0.12)",
};

export function progressPct(p) {
  if (!p || p.totalItems === 0) return 0;
  return Math.round((p.avgRetrievability || 0) * 100);
}

export function isTopicLocked() {
  return false;
}

export function findStartHereTopic(topics, progress, matchesByTopic) {
  const hasMatches = matchesByTopic.size > 0;

  if (hasMatches) {
    for (const topic of topics) {
      const p = progress?.[topic.id];
      const isMastered = p?.label === "Mastered";
      const hasMaterial = matchesByTopic.has(topic.id);
      if (!isMastered && hasMaterial) return topic;
    }
  }

  for (const topic of topics) {
    const p = progress?.[topic.id];
    const isMastered = p?.label === "Mastered";
    if (!isMastered) return topic;
  }

  return null;
}

export function StatItem({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 16, fontWeight: 700, color, fontFamily: FONTS.display }}>{value}</span>
      <span style={{ fontSize: 9, color: D.textMid, fontFamily: FONTS.body }}>{label}</span>
    </div>
  );
}

export function Badge({ text, bg, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, fontFamily: FONTS.body, color,
      background: bg, padding: "2px 7px", borderRadius: 8, whiteSpace: "nowrap",
    }}>
      {text}
    </span>
  );
}

const DOC_ICONS = {
  pdf: "📄", docx: "📝", doc: "📝", pptx: "📊", image: "🖼️",
  txt: "📃", note: "📃", tutorial_question: "❓",
  mcq: "✎", flashcard_deck: "🎴", summary: "📝",
};

// Tappable document row — opens the practice menu for that material.
export function DocRow({ match, variants, onTap }) {
  const [hover, setHover] = useState(false);
  const r = match.resource || {};
  const conf = match.confidence != null ? Math.round(match.confidence * 100) : null;
  const chips = [variants?.mcq && "✎", variants?.flashcard && "🎴", variants?.summary && "📝"].filter(Boolean);
  const meta = [r.contentType, conf != null ? `${conf}% match` : null, chips.length ? chips.join(" ") : null]
    .filter(Boolean).join(" · ");
  return (
    <button
      onClick={onTap}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left",
        padding: "10px 12px", borderRadius: 10, cursor: "pointer",
        background: hover ? "rgba(245,166,35,0.07)" : D.ink,
        border: `0.5px solid ${hover ? D.gold + "44" : "transparent"}`,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      <span style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: "rgba(245,166,35,0.1)", display: "flex",
        alignItems: "center", justifyContent: "center", fontSize: 14,
      }}>
        {DOC_ICONS[r.contentType] || "📄"}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: "block", fontSize: 12, fontWeight: 600, color: D.textHi,
          fontFamily: FONTS.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {r.title || "Untitled"}
        </span>
        <span style={{ display: "block", fontSize: 10, color: D.textLow, fontFamily: FONTS.body, marginTop: 2 }}>
          {meta}
        </span>
      </span>
      <span style={{ color: hover ? D.gold : D.textLow, fontSize: 15, flexShrink: 0 }}>›</span>
    </button>
  );
}

// Compact practice sheet used when no host-level sheet is wired (standalone
// roadmap view). Offers whatever is available for the tapped document.
function DocPracticeSheet({ match, variants, topic, onOpenResource, onStartStudying, onClose }) {
  if (!match) return null;
  const r = match.resource || {};
  const btn = (icon, label, sub, fn, primary) => (
    <button key={label} onClick={() => { onClose(); fn?.(); }} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
      padding: "12px 14px", borderRadius: 12, cursor: "pointer", marginTop: 6,
      background: primary ? "linear-gradient(135deg, #b8860b, #F5A623)" : "rgba(255,255,255,0.04)",
      border: primary ? "none" : `0.5px solid ${D.border}`,
    }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ flex: 1 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: primary ? "#0a0a0a" : D.textHi, fontFamily: FONTS.body }}>{label}</span>
        {sub && <span style={{ display: "block", fontSize: 10, color: primary ? "rgba(0,0,0,0.55)" : D.textLow, fontFamily: FONTS.body, marginTop: 1 }}>{sub}</span>}
      </span>
      <span style={{ color: primary ? "#0a0a0a" : D.textLow }}>›</span>
    </button>
  );
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 10050, background: "rgba(7,9,13,0.72)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 480, background: "#12161F",
          border: `1px solid ${D.border}`, borderRadius: "20px 20px 0 0",
          padding: "10px 18px 28px",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: D.border, margin: "4px auto 14px" }} />
        <div style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.mono, letterSpacing: "0.08em", marginBottom: 2 }}>PRACTICE</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display, marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {r.title || "Untitled"}
        </div>
        {variants?.mcq && btn("✎", "MCQs", "Practice questions", () => onOpenResource?.(variants.mcq.shareToken))}
        {variants?.flashcard && btn("🎴", "Flashcards", "Review the deck", () => onOpenResource?.(variants.flashcard.shareToken))}
        {variants?.summary && btn("📝", "Summary", "Read the AI summary", () => onOpenResource?.(variants.summary.shareToken))}
        {r.shareToken && btn("📄", "View material", "Open the original document", () => onOpenResource?.(r.shareToken))}
        {onStartStudying && btn("⚡", "Practice this topic", "AI Tutor with topic context", () => onStartStudying(topic), true)}
      </div>
    </div>
  );
}

export function TopicDetailPanel({ topic, topics, progress, matches, onOpenResource, onStartStudying, isStartHere, resourceVariantsMap, onPracticeDoc }) {
  const p = progress;
  const progressLabel = p?.label || "Not started";
  const progressColor = PROGRESS_COLORS[progressLabel] || D.textLow;
  const pct = progressPct(p);
  const [docSheet, setDocSheet] = useState(null); // match tapped for practice (fallback sheet)

  const subtopicCount = (topic.subtopics?.length || 0);
  const estMinutes = (subtopicCount * 5) + (matches.length * 10);
  const estTimeStr = estMinutes >= 60 ? `${Math.floor(estMinutes / 60)}h ${estMinutes % 60}m` : `~${estMinutes}m`;

  const hasAnyMaterial = matches.some((m) => {
    const v = resourceVariantsMap?.get(m.resourceId);
    return v?.mcq || v?.flashcard || v?.summary;
  });

  const openDocPractice = (m) => {
    if (onPracticeDoc) { onPracticeDoc(m); return; }
    setDocSheet(m);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Section 1: Identity & Status */}
      <div style={{
        background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "18px 20px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: D.textLow, fontFamily: FONTS.mono }}>
            #{topic.displayOrder}
          </span>
          {isStartHere && (
            <span style={{
              fontSize: 9, fontWeight: 600, color: D.gold, background: "rgba(245,166,35,0.15)",
              padding: "2px 8px", borderRadius: 8, fontFamily: FONTS.body,
            }}>START HERE</span>
          )}
          {topic.source === "outline" && (
            <span style={{
              fontSize: 9, fontWeight: 600, color: D.green, background: "rgba(61,214,140,0.1)",
              padding: "2px 8px", borderRadius: 8, fontFamily: FONTS.body,
            }}>OUTLINE</span>
          )}
          {topic.status === "disputed" && (
            <span style={{
              fontSize: 9, fontWeight: 600, color: D.coral, background: "rgba(255,84,112,0.1)",
              padding: "2px 8px", borderRadius: 8, fontFamily: FONTS.body,
            }}>DISPUTED</span>
          )}
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display, marginBottom: 4 }}>
          {topic.title}
        </div>
        {topic.description && (
          <div style={{ fontSize: 13, color: D.textMid, fontFamily: FONTS.body, lineHeight: 1.5 }}>
            {topic.description}
          </div>
        )}

        {/* Progress bar */}
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: D.textMid, fontFamily: FONTS.body }}>Progress</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: progressColor, fontFamily: FONTS.body }}>{progressLabel} · {pct}%</span>
          </div>
          <div style={{ height: 6, background: D.ink, borderRadius: 3, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: progressLabel === "Mastered" ? D.green : progressColor,
              borderRadius: 3, transition: "width 0.3s",
            }} />
          </div>
        </div>

        {/* FSRS stats */}
        {p && p.totalItems > 0 && (
          <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
            <span>{p.totalItems} items</span>
            <span>Stability: {p.avgStability}</span>
            <span>Retrievability: {Math.round(p.avgRetrievability * 100)}%</span>
            <span>{p.masteredCount} mastered</span>
          </div>
        )}

        {/* Estimated study time */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
          <span style={{ fontSize: 12 }}>⏱️</span>
          <span>Estimated study time: <strong style={{ color: D.gold }}>{estTimeStr}</strong></span>
          <span style={{ color: D.textLow, fontSize: 10 }}>({subtopicCount} subtopics · {matches.length} docs)</span>
        </div>
      </div>

      {/* Section 2: Action buttons */}
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {matches.length > 0 && onStartStudying && (
          <button
            onClick={() => onStartStudying(topic)}
            style={{
              flex: 1, background: "linear-gradient(135deg, #b8860b, #F5A623)", border: "none",
              borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600,
              color: "#0a0a0a", cursor: "pointer", fontFamily: FONTS.body,
            }}
          >
            {hasAnyMaterial ? "Practice Materials →" : "Practice with AI Tutor →"}
          </button>
        )}
        {!matches.length && onStartStudying && (
          <button
            onClick={() => onStartStudying(topic)}
            style={{
              flex: 1, background: "linear-gradient(135deg, #b8860b, #F5A623)", border: "none",
              borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600,
              color: "#0a0a0a", cursor: "pointer", fontFamily: FONTS.body,
            }}
          >
            Practice with AI Tutor →
          </button>
        )}
      </div>

      {/* Section 3: Documents — one clean row per matched doc; tap opens its
          practice menu (host PracticeSheet when wired, else the in-panel sheet) */}
      <div style={{
        background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "16px 20px",
      }}>
        <div style={{ fontSize: 11, color: D.textLow, fontFamily: FONTS.body, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Documents ({matches.length})
        </div>
        {matches.length === 0 ? (
          <div style={{ fontSize: 12, color: D.textMid, fontFamily: FONTS.body, fontStyle: "italic" }}>
            No documents matched to this topic yet. Upload materials for this course to auto-match.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {matches.map((m) => (
              <DocRow
                key={m.id}
                match={m}
                variants={resourceVariantsMap?.get(m.resourceId)}
                onTap={() => openDocPractice(m)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section 4: Subtopics checklist */}
      {topic.subtopics && topic.subtopics.length > 0 && (
        <div style={{
          background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "16px 20px",
        }}>
          <div style={{ fontSize: 11, color: D.textLow, fontFamily: FONTS.body, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Subtopics
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topic.subtopics.map((sub, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${D.border}`,
                  flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, color: D.green,
                }}>
                  {pct > 60 ? "✓" : ""}
                </span>
                <span style={{ fontSize: 12, color: D.textHi, fontFamily: FONTS.body }}>
                  {sub}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 5: Prerequisite chain */}
      {topic.prerequisiteIds && topic.prerequisiteIds.length > 0 && (
        <div style={{
          background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "16px 20px",
        }}>
          <div style={{ fontSize: 11, color: D.textLow, fontFamily: FONTS.body, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Prerequisites
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {topic.prerequisiteIds.map((pid) => {
              const prereq = topics.find((t) => t.id === pid);
              if (!prereq) return null;
              const prereqProgress = progress?.[pid];
              const prereqMastered = prereqProgress?.label === "Mastered";
              return (
                <div key={pid} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px", background: D.ink, borderRadius: 6,
                }}>
                  <span style={{ fontSize: 11, color: prereqMastered ? D.green : D.textLow }}>
                    {prereqMastered ? "✓" : "○"}
                  </span>
                  <span style={{ fontSize: 12, color: D.textHi, fontFamily: FONTS.body, flex: 1 }}>
                    {prereq.title}
                  </span>
                  <span style={{
                    fontSize: 9, fontFamily: FONTS.body,
                    color: prereqMastered ? D.green : D.textMid,
                  }}>
                    {prereqMastered ? "Mastered" : (prereqProgress?.label || "Not started")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fallback practice menu — only when the host didn't wire onPracticeDoc */}
      {!onPracticeDoc && (
        <DocPracticeSheet
          match={docSheet}
          variants={docSheet ? resourceVariantsMap?.get(docSheet.resourceId) : null}
          topic={topic}
          onOpenResource={onOpenResource}
          onStartStudying={onStartStudying}
          onClose={() => setDocSheet(null)}
        />
      )}
    </div>
  );
}

export function OnboardingStep({ number, title, description, icon, done, actionLabel, onAction, disabled, highlight }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", borderRadius: 12,
      background: highlight ? "rgba(245,166,35,0.06)" : D.panel,
      border: done ? `0.5px solid ${D.green}33` : highlight ? `0.5px solid ${D.gold}33` : `0.5px solid ${D.border}`,
      transition: "border-color 0.2s, background 0.2s",
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: done ? "rgba(61,214,140,0.15)" : highlight ? "rgba(245,166,35,0.15)" : D.ink,
        border: done ? `1px solid ${D.green}44` : highlight ? `1px solid ${D.gold}44` : `1px solid ${D.border}`,
        fontSize: 12, fontWeight: 700, fontFamily: FONTS.display,
        color: done ? D.green : highlight ? D.gold : D.textMid,
      }}>
        {done ? "✓" : number}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.textHi, fontFamily: FONTS.body, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body, marginTop: 2 }}>
          {description}
        </div>
      </div>

      {onAction && (
        <button
          onClick={onAction}
          disabled={disabled}
          style={{
            background: highlight ? "linear-gradient(135deg, #b8860b, #F5A623)" : D.ink,
            border: highlight ? "none" : `0.5px solid ${D.border}`,
            borderRadius: 8, padding: "8px 14px",
            fontSize: 11, fontWeight: 600,
            color: highlight ? "#0a0a0a" : done ? D.green : D.textMid,
            cursor: disabled ? "not-allowed" : "pointer",
            fontFamily: FONTS.body, whiteSpace: "nowrap", flexShrink: 0,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {actionLabel}
        </button>
      )}
      {!onAction && (
        <span style={{
          fontSize: 11, color: done ? D.green : D.textLow, fontFamily: FONTS.body,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 120,
        }}>
          {actionLabel}
        </span>
      )}
    </div>
  );
}

/**
 * Render a single timeline topic row (shared between standalone and embedded views).
 */
export function TimelineTopicRow({ topic, idx, topics, progress, matchesByTopic, selectedTopicId, startHereTopic, onSelectTopic, onStartStudying, isMobile, isLast, editMode, onDragStart }) {
  const p = progress?.[topic.id];
  const pct = progressPct(p);
  const ringColor = p?.label === "Mastered" ? "#3DD68C" : pct > 0 ? "#F5A623" : "rgba(255,255,255,0.12)";
  const RC = 2 * Math.PI * 15; // r=15 ring around the node
  const topicMatches = matchesByTopic.get(topic.id) || [];
  const isSelected = selectedTopicId === topic.id;
  const isStartHere = startHereTopic?.id === topic.id;
  const progressLabel = p?.label || "Not started";
  const isCurrent = isStartHere || (progressLabel === "Not started" && topicMatches.length > 0);
  const nodeClass = isCurrent ? "cs-topic-node cs-topic-node-current" : "cs-topic-node cs-topic-node-upcoming";

  return (
    <div
      key={topic.id}
      data-topic-id={topic.id}
      onClick={() => { if (!editMode) onSelectTopic(topic.id); }}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 14,
        padding: "15px 4px", cursor: editMode ? "default" : "pointer",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
        background: isSelected && !editMode ? "rgba(245,166,35,0.06)" : "transparent",
        transition: "background 0.15s",
      }}
    >
      <div
        className="cs-drag-handle"
        onPointerDown={editMode ? (e) => onDragStart(e, topic.id) : undefined}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/>
          <circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/>
          <circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/>
        </svg>
      </div>

      <div className={nodeClass} style={{ position: "relative" }}>
        <svg width="36" height="36" viewBox="0 0 36 36" style={{ position: "absolute", left: -4, top: -4, pointerEvents: "none" }}>
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="2.5" />
          <circle cx="18" cy="18" r="15" fill="none" stroke={ringColor} strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={RC.toFixed(1)} strokeDashoffset={(RC * (1 - pct / 100)).toFixed(1)}
            transform="rotate(-90 18 18)" />
        </svg>
        {idx + 1}
      </div>
      {!isLast && !editMode && <div className="cs-topic-line" />}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: FONTS.body, color: D.textHi, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {topic.title}
        </div>
        <div style={{ fontSize: 11, color: D.textLow, marginTop: 2, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {progressLabel}
          {topicMatches.length > 0 && (
            <span style={{ color: D.blue }}>· {topicMatches.length} docs</span>
          )}
        </div>
      </div>

      {!editMode && topicMatches.length > 0 && onStartStudying && (
        <button
          onClick={(e) => { e.stopPropagation(); onStartStudying(topic); }}
          title="Study this topic now"
          style={{
            background: "rgba(245,166,35,0.12)", border: `0.5px solid ${D.gold}33`,
            borderRadius: 6, padding: "2px 8px", fontSize: 10, color: D.gold,
            cursor: "pointer", fontFamily: FONTS.body, fontWeight: 600, flexShrink: 0,
          }}
        >
          ▶
        </button>
      )}
    </div>
  );
}
