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

export function isTopicLocked(topic, topics, progress) {
  if (!topic.prerequisiteIds || topic.prerequisiteIds.length === 0) return false;
  for (const pid of topic.prerequisiteIds) {
    const prereq = topics.find((t) => t.id === pid);
    if (!prereq) continue;
    const prereqProgress = progress?.[pid];
    if (!prereqProgress || prereqProgress.label !== "Mastered") return true;
  }
  return false;
}

export function findStartHereTopic(topics, progress, matchesByTopic) {
  const hasMatches = matchesByTopic.size > 0;

  if (hasMatches) {
    for (const topic of topics) {
      const p = progress?.[topic.id];
      const isMastered = p?.label === "Mastered";
      const locked = isTopicLocked(topic, topics, progress);
      const hasMaterial = matchesByTopic.has(topic.id);
      if (!isMastered && !locked && hasMaterial) return topic;
    }
  }

  for (const topic of topics) {
    const p = progress?.[topic.id];
    const isMastered = p?.label === "Mastered";
    const locked = isTopicLocked(topic, topics, progress);
    if (!isMastered && !locked) return topic;
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

export function TopicDetailPanel({ topic, topics, progress, matches, onOpenResource, onStartStudying, onCorroborate, onDispute, locked, isStartHere, resourceVariantsMap, resourceByIdMap, onGenerate }) {
  const p = progress;
  const progressLabel = p?.label || "Not started";
  const progressColor = PROGRESS_COLORS[progressLabel] || D.textLow;
  const pct = progressPct(p);
  const contentAccessible = !locked || matches.length > 0;

  const subtopicCount = (topic.subtopics?.length || 0);
  const estMinutes = (subtopicCount * 5) + (matches.length * 10);
  const estTimeStr = estMinutes >= 60 ? `${Math.floor(estMinutes / 60)}h ${estMinutes % 60}m` : `~${estMinutes}m`;

  // Collect all study materials from matched documents
  const studyMaterials = matches.map(m => {
    const variants = resourceVariantsMap?.get(m.resourceId) || { summary: null, mcq: null, flashcard: null };
    return { match: m, variants };
  });
  const hasFlashcards = studyMaterials.some(sm => sm.variants?.flashcard);
  const hasMcqs = studyMaterials.some(sm => sm.variants?.mcq);
  const hasSummary = studyMaterials.some(sm => sm.variants?.summary);
  const hasAnyMaterial = hasFlashcards || hasMcqs || hasSummary;

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
        {locked && matches.length === 0 ? (
          <div style={{
            flex: 1, textAlign: "center", padding: "12px", background: "rgba(86,94,110,0.1)",
            border: `0.5px solid ${D.border}`, borderRadius: 8,
            fontSize: 12, color: D.textLow, fontFamily: FONTS.body,
          }}>
            🔒 Locked — complete prerequisites first
          </div>
        ) : (
          <>
            {locked && matches.length > 0 && (
              <span style={{
                fontSize: 10, fontWeight: 600, color: D.gold, background: "rgba(245,166,35,0.12)",
                padding: "4px 10px", borderRadius: 8, fontFamily: FONTS.body,
                display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
              }}>
                🔒 Locked · content available
              </span>
            )}
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
            <button
              onClick={() => onCorroborate(topic.id)}
              disabled={topic.source === "outline"}
              style={{
                flex: 1, background: "rgba(61,214,140,0.1)", border: `0.5px solid ${D.green}44`,
                borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600,
                color: topic.source === "outline" ? D.textLow : D.green,
                cursor: topic.source === "outline" ? "default" : "pointer", fontFamily: FONTS.body,
              }}
            >
              ✓ Corroborate
            </button>
            <button
              onClick={() => onDispute(topic.id)}
              disabled={topic.source === "outline"}
              style={{
                flex: 1, background: "rgba(255,84,112,0.08)", border: `0.5px solid ${D.coral}33`,
                borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600,
                color: topic.source === "outline" ? D.textLow : D.coral,
                cursor: topic.source === "outline" ? "default" : "pointer", fontFamily: FONTS.body,
              }}
            >
              ✗ Dispute
            </button>
          </>
        )}
      </div>

      {/* Verification stats */}
      {topic.source !== "outline" && (
        <div style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.body, textAlign: "center" }}>
          {topic.corroboratingUserIds?.length || 0} corroborations · {topic.disputeUserIds?.length || 0} disputes
          {topic.avgConfidence > 0 && ` · Avg confidence: ${Math.round(topic.avgConfidence * 100)}%`}
        </div>
      )}

      {/* Section 3: Subtopics checklist */}
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

      {/* Section 3b: Study Materials (flashcards, MCQs, summaries from matched docs) */}
      {contentAccessible && matches.length > 0 && (resourceVariantsMap || onGenerate) && (
        <div style={{
          background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "16px 20px",
        }}>
          <div style={{ fontSize: 11, color: D.textLow, fontFamily: FONTS.body, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Study Materials
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {studyMaterials.map(({ match: m, variants }) => (
              <div key={m.id} style={{
                padding: "10px 12px", background: D.ink, borderRadius: 8,
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.body, fontStyle: "italic" }}>
                  from: {m.resource?.title || "Unknown"}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {/* Summary */}
                  {variants?.summary ? (
                    <button
                      onClick={() => onOpenResource?.(variants.summary.shareToken)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "rgba(79,142,247,0.1)", border: `0.5px solid ${D.blue}33`,
                        borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600,
                        color: D.blue, cursor: "pointer", fontFamily: FONTS.body,
                      }}
                    >📝 Summary · Open</button>
                  ) : onGenerate ? (
                    <button
                      onClick={() => onGenerate?.(resourceByIdMap?.get(m.resourceId) || m.resource, "summary")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "transparent", border: `0.5px dashed ${D.border}`,
                        borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600,
                        color: D.textLow, cursor: "pointer", fontFamily: FONTS.body,
                      }}
                    >+ Summary</button>
                  ) : null}

                  {/* Flashcards */}
                  {variants?.flashcard ? (
                    <button
                      onClick={() => onOpenResource?.(variants.flashcard.shareToken)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "rgba(61,214,140,0.1)", border: `0.5px solid ${D.green}33`,
                        borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600,
                        color: D.green, cursor: "pointer", fontFamily: FONTS.body,
                      }}
                    >🎴 Flashcards · Study</button>
                  ) : onGenerate ? (
                    <button
                      onClick={() => onGenerate?.(resourceByIdMap?.get(m.resourceId) || m.resource, "flashcards")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "transparent", border: `0.5px dashed ${D.border}`,
                        borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600,
                        color: D.textLow, cursor: "pointer", fontFamily: FONTS.body,
                      }}
                    >+ Flashcards</button>
                  ) : null}

                  {/* MCQs */}
                  {variants?.mcq ? (
                    <button
                      onClick={() => onOpenResource?.(variants.mcq.shareToken)}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "rgba(245,166,35,0.1)", border: `0.5px solid ${D.gold}33`,
                        borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600,
                        color: D.gold, cursor: "pointer", fontFamily: FONTS.body,
                      }}
                    >✎ MCQs · Practice</button>
                  ) : onGenerate ? (
                    <button
                      onClick={() => onGenerate?.(resourceByIdMap?.get(m.resourceId) || m.resource, "mcqs")}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "transparent", border: `0.5px dashed ${D.border}`,
                        borderRadius: 6, padding: "4px 10px", fontSize: 10, fontWeight: 600,
                        color: D.textLow, cursor: "pointer", fontFamily: FONTS.body,
                      }}
                    >+ MCQs</button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 4: Mapped documents */}
      <div style={{
        background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 12, padding: "16px 20px",
      }}>
        <div style={{ fontSize: 11, color: D.textLow, fontFamily: FONTS.body, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Mapped Documents ({matches.length})
        </div>
        {matches.length === 0 ? (
          <div style={{ fontSize: 12, color: D.textMid, fontFamily: FONTS.body, fontStyle: "italic" }}>
            No documents matched to this topic yet. Upload materials for this course to auto-match.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {matches.map((m) => (
              <div key={m.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", background: D.ink, borderRadius: 8,
              }}>
                <span style={{ fontSize: 11, color: D.textHi, fontFamily: FONTS.body, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.resource?.title || "Unknown"}
                </span>
                <span style={{ fontSize: 9, color: D.textLow, fontFamily: FONTS.body }}>
                  {m.resource?.contentType}
                </span>
                <span style={{ fontSize: 9, color: D.gold, fontFamily: FONTS.body }}>
                  {Math.round(m.confidence * 100)}%
                </span>
                {m.resource?.shareToken && onOpenResource && (
                  <button
                    onClick={() => { if (!(locked && matches.length === 0)) onOpenResource(m.resource.shareToken); }}
                    disabled={locked && matches.length === 0}
                    style={{
                      background: "none", border: `0.5px solid ${(locked && matches.length === 0) ? D.border : D.border}`, borderRadius: 4,
                      padding: "3px 10px", fontSize: 10, color: (locked && matches.length === 0) ? D.textLow : D.blue,
                      cursor: (locked && matches.length === 0) ? "not-allowed" : "pointer", fontFamily: FONTS.body,
                    }}
                  >
                    {(locked && matches.length === 0) ? "🔒" : "Open"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
export function TimelineTopicRow({ topic, idx, topics, progress, matchesByTopic, selectedTopicId, startHereTopic, onSelectTopic, onStartStudying, isMobile, isLast }) {
  const p = progress?.[topic.id];
  const topicMatches = matchesByTopic.get(topic.id) || [];
  const isSelected = selectedTopicId === topic.id;
  const isStartHere = startHereTopic?.id === topic.id;
  const progressLabel = p?.label || "Not started";
  const locked = isTopicLocked(topic, topics, progress);
  const contentAccessible = !locked || topicMatches.length > 0;
  const isCurrent = isStartHere || (!locked && progressLabel === "Not started" && topicMatches.length > 0);
  const nodeClass = isCurrent ? "cs-topic-node cs-topic-node-current" : "cs-topic-node cs-topic-node-upcoming";

  return (
    <div
      key={topic.id}
      onClick={() => { if (contentAccessible) onSelectTopic(topic.id); }}
      style={{
        position: "relative", display: "flex", alignItems: "center", gap: 14,
        padding: "15px 4px", cursor: contentAccessible ? "pointer" : "default",
        borderBottom: isLast ? "none" : "1px solid rgba(255,255,255,0.05)",
        background: isSelected ? "rgba(245,166,35,0.06)" : "transparent",
        transition: "background 0.15s",
        opacity: !contentAccessible ? 0.45 : (locked ? 0.8 : 1),
        ...(locked && contentAccessible && !isSelected ? { boxShadow: "inset 2px 0 0 rgba(245,166,35,0.25)" } : {}),
      }}
    >
      <div className={nodeClass} style={locked ? { opacity: 0.6 } : {}}>
        {locked ? "🔒" : (topic.displayOrder || idx + 1)}
      </div>
      {!isLast && <div className="cs-topic-line" />}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, fontFamily: FONTS.body, color: !contentAccessible ? D.textLow : D.textHi, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {topic.title}
        </div>
        <div style={{ fontSize: 11, color: D.textLow, marginTop: 2, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          {locked ? "Locked" : progressLabel}
          {topicMatches.length > 0 && (
            <span style={{ color: contentAccessible ? D.blue : D.textLow }}>· {topicMatches.length} docs{locked && contentAccessible ? " · available" : ""}</span>
          )}
        </div>
      </div>

      {contentAccessible && topicMatches.length > 0 && onStartStudying && (
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
