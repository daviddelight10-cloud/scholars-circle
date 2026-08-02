import { useState, useEffect, useMemo, useCallback } from "react";
import {
  fetchSkeleton,
  fetchTopicProgress,
  fetchTopicMatches,
  generateSkeleton,
  corroborateTopic,
  disputeTopic,
} from "../../lib/skeletonGenerator";
import { retroactiveMatch } from "../../lib/topicMatcher";
import { listFolders } from "../../lib/foldersApi";
import { FONTS } from "../../lib/theme";

const D = {
  ink: "#07090D",
  panel: "rgba(255,255,255,0.05)",
  panel2: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.09)",
  gold: "#F5A623",
  blue: "#4F8EF7",
  green: "#3DD68C",
  coral: "#FF5470",
  textHi: "#F5F7FB",
  textMid: "#9AA2B2",
  textLow: "#565E6E",
};

const PROGRESS_COLORS = {
  "Not started": D.textLow,
  "New": D.coral,
  "Learning": D.gold,
  "Reviewing": D.blue,
  "Mastered": D.green,
};

const PROGRESS_BG = {
  "Not started": "rgba(86,94,110,0.15)",
  "New": "rgba(255,84,112,0.12)",
  "Learning": "rgba(245,166,35,0.12)",
  "Reviewing": "rgba(79,142,247,0.12)",
  "Mastered": "rgba(61,214,140,0.12)",
};

export default function TopicSkeletonView({ courseCode: initialCourseCode, onExit, onOpenResource }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(initialCourseCode || "");
  const [topics, setTopics] = useState([]);
  const [progress, setProgress] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [error, setError] = useState("");
  const [matchProgress, setMatchProgress] = useState(null);
  const [expandedTopic, setExpandedTopic] = useState(null);

  // Build course list from folders + resource subjects
  useEffect(() => {
    async function loadCourses() {
      const courseSet = new Set();
      const courseList = [];
      try {
        const folders = await listFolders();
        const allFolders = [...(folders.own || []), ...(folders.shared || []), ...(folders.link || [])];
        for (const f of allFolders) {
          if (f.courseCode && !courseSet.has(f.courseCode)) {
            courseSet.add(f.courseCode);
            courseList.push(f.courseCode);
          }
        }
      } catch {}
      try {
        const cached = localStorage.getItem("sc_resources_list");
        if (cached) {
          const parsed = JSON.parse(cached);
          const resources = parsed.data || parsed;
          for (const r of resources) {
            if (r.subject && !courseSet.has(r.subject)) {
              courseSet.add(r.subject);
              courseList.push(r.subject);
            }
          }
        }
      } catch {}
      setCourses(courseList);
    }
    loadCourses();
  }, []);

  const loadData = useCallback(async (course) => {
    if (!course) return;
    setLoading(true);
    setError("");
    try {
      const t = await fetchSkeleton(course);
      setTopics(t);
      if (t.length > 0) {
        const [prog, mtch] = await Promise.all([
          fetchTopicProgress(course),
          fetchTopicMatches(course),
        ]);
        setProgress(prog);
        setMatches(mtch);
      } else {
        setProgress(null);
        setMatches([]);
      }
    } catch (err) {
      setError(err.message);
      setTopics([]);
      setProgress(null);
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCourse) loadData(selectedCourse);
  }, [selectedCourse, loadData]);

  // Group matches by topic
  const matchesByTopic = useMemo(() => {
    const map = new Map();
    for (const m of matches) {
      if (!map.has(m.topicId)) map.set(m.topicId, []);
      map.get(m.topicId).push(m);
    }
    return map;
  }, [matches]);

  const stats = useMemo(() => {
    if (topics.length === 0) return null;
    if (!progress) return { total: topics.length, mastered: 0, learning: 0, notStarted: topics.length };
    let mastered = 0, learning = 0, notStarted = 0;
    for (const t of topics) {
      const p = progress[t.id];
      if (!p || p.label === "Not started") notStarted++;
      else if (p.label === "Mastered") mastered++;
      else learning++;
    }
    return { total: topics.length, mastered, learning, notStarted };
  }, [topics, progress]);

  const masteredPct = stats ? Math.round((stats.mastered / stats.total) * 100) : 0;

  async function handleGenerate() {
    if (!selectedCourse.trim()) return;
    setGenerating(true);
    setError("");
    setGenProgress("Generating topic skeleton with AI…");
    try {
      const result = await generateSkeleton({
        courseName: selectedCourse,
        onProgress: setGenProgress,
      });
      setTopics(result.topics);
      setGenProgress(`Generated ${result.topics.length} topics ✓`);
      // Load progress and matches
      const [prog, mtch] = await Promise.all([
        fetchTopicProgress(selectedCourse),
        fetchTopicMatches(selectedCourse),
      ]);
      setProgress(prog);
      setMatches(mtch);
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
      setTimeout(() => setGenProgress(""), 3000);
    }
  }

  async function handleRetroactiveMatch() {
    if (!selectedCourse.trim()) return;
    setMatchProgress({ current: 0, total: 0, label: "Starting…" });
    try {
      const result = await retroactiveMatch(selectedCourse, (idx, total, name) => {
        setMatchProgress({ current: idx, total, label: name });
      });
      setMatchProgress({ current: result.resourceCount, total: result.resourceCount, label: `Done — ${result.matchCount} matches` });
      // Reload matches
      const mtch = await fetchTopicMatches(selectedCourse);
      setMatches(mtch);
      setTimeout(() => setMatchProgress(null), 3000);
    } catch (err) {
      setError(err.message);
      setMatchProgress(null);
    }
  }

  async function handleCorroborate(topicId) {
    try {
      await corroborateTopic(topicId);
      loadData(selectedCourse);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDispute(topicId) {
    try {
      await disputeTopic(topicId);
      loadData(selectedCourse);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: D.ink, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
        borderBottom: `0.5px solid ${D.border}`,
        background: "rgba(10,12,18,0.95)", backdropFilter: "blur(10px)",
        flexShrink: 0,
      }}>
        <button onClick={onExit} style={{
          background: "none", border: "none", color: D.textMid, fontSize: 20, cursor: "pointer", padding: "4px 8px",
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
            Topic Skeleton
          </div>
          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
            Curriculum roadmap & document matching
          </div>
        </div>

        {/* Course selector */}
        <input
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          placeholder="Course code…"
          list="skeletonViewCourses"
          style={{
            background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 8,
            padding: "8px 14px", fontSize: 12, color: D.textHi, fontFamily: FONTS.body,
            outline: "none", width: 200,
          }}
        />
        <datalist id="skeletonViewCourses">
          {courses.map((c) => <option key={c} value={c} />)}
        </datalist>

        {topics.length > 0 && (
          <button onClick={handleRetroactiveMatch} disabled={!!matchProgress} style={{
            background: D.panel, border: `0.5px solid ${D.blue}`, borderRadius: 8,
            padding: "8px 14px", fontSize: 11, color: D.blue, cursor: matchProgress ? "not-allowed" : "pointer",
            fontFamily: FONTS.body, fontWeight: 600, whiteSpace: "nowrap",
          }}>
            {matchProgress ? `Matching ${matchProgress.current}/${matchProgress.total}…` : "🔗 Match Documents"}
          </button>
        )}

        <button onClick={handleGenerate} disabled={generating || !selectedCourse.trim()} style={{
          background: generating ? "rgba(245,166,35,0.15)" : "linear-gradient(135deg, #b8860b, #F5A623)",
          border: "none", borderRadius: 8, padding: "8px 16px",
          fontSize: 12, fontWeight: 600, color: generating ? D.gold : "#0a0a0a",
          cursor: generating ? "not-allowed" : "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap",
        }}>
          {generating ? "Generating…" : topics.length > 0 ? "Regenerate" : "Build Roadmap"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "8px 20px", background: "rgba(255,84,112,0.1)", borderBottom: `0.5px solid ${D.coral}33` }}>
          <span style={{ fontSize: 12, color: D.coral, fontFamily: FONTS.body }}>{error}</span>
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", color: D.coral, cursor: "pointer", fontSize: 14 }}>×</button>
        </div>
      )}

      {/* Progress messages */}
      {(genProgress || matchProgress) && (
        <div style={{ padding: "8px 20px", background: "rgba(245,166,35,0.08)", borderBottom: `0.5px solid ${D.gold}22` }}>
          <span style={{ fontSize: 12, color: D.gold, fontFamily: FONTS.body }}>
            {genProgress || (matchProgress ? `${matchProgress.label} (${matchProgress.current}/${matchProgress.total})` : "")}
          </span>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: D.textMid, fontSize: 14, fontFamily: FONTS.body }}>
            Loading skeleton…
          </div>
        ) : topics.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: D.textHi, marginBottom: 8, fontFamily: FONTS.display }}>
              {selectedCourse ? `No skeleton for ${selectedCourse}` : "Select a course to begin"}
            </div>
            <div style={{ fontSize: 13, color: D.textMid, fontFamily: FONTS.body, lineHeight: 1.6, marginBottom: 20 }}>
              {selectedCourse
                ? "Click \"Build Roadmap\" to generate an AI-powered topic skeleton, or upload a course outline via the Smart Study input."
                : "Type a course code above or select from your folders to build a curriculum roadmap."}
            </div>
          </div>
        ) : (
          <>
            {/* Stats summary */}
            {stats && (
              <div style={{
                display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap",
              }}>
                <div style={{
                  flex: "1 1 300px", background: D.panel, border: `0.5px solid ${D.border}`,
                  borderRadius: 12, padding: "16px 18px",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: D.textMid, fontFamily: FONTS.body }}>Overall Mastery</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: D.gold, fontFamily: FONTS.display }}>{masteredPct}%</span>
                  </div>
                  <div style={{ height: 8, background: D.ink, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${masteredPct}%`, background: `linear-gradient(90deg, ${D.gold}, ${D.green})`, borderRadius: 4, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                    <StatItem label="Mastered" value={stats.mastered} color={D.green} />
                    <StatItem label="Learning" value={stats.learning} color={D.gold} />
                    <StatItem label="Not Started" value={stats.notStarted} color={D.textLow} />
                  </div>
                </div>
              </div>
            )}

            {/* Topic list */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 800 }}>
              {topics.map((topic, idx) => {
                const p = progress?.[topic.id];
                const topicMatches = matchesByTopic.get(topic.id) || [];
                const isExpanded = expandedTopic === topic.id;
                const progressLabel = p?.label || "Not started";
                const progressColor = PROGRESS_COLORS[progressLabel] || D.textLow;
                const progressBg = PROGRESS_BG[progressLabel] || "transparent";

                return (
                  <div key={topic.id} style={{
                    background: D.panel, border: `0.5px solid ${isExpanded ? D.gold + "44" : D.border}`,
                    borderRadius: 10, overflow: "hidden", transition: "border-color 0.2s",
                  }}>
                    {/* Topic row */}
                    <div
                      onClick={() => setExpandedTopic(isExpanded ? null : topic.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer",
                      }}
                    >
                      {/* Order number */}
                      <span style={{ fontSize: 12, color: D.textLow, fontFamily: FONTS.mono, width: 24, textAlign: "right" }}>
                        {topic.displayOrder || idx + 1}
                      </span>

                      {/* Title + description */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: D.textHi, fontFamily: FONTS.body }}>
                          {topic.title}
                        </div>
                        {topic.description && (
                          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {topic.description}
                          </div>
                        )}
                      </div>

                      {/* Progress badge */}
                      <div style={{
                        padding: "3px 10px", borderRadius: 12, fontSize: 10, fontWeight: 600,
                        fontFamily: FONTS.body, color: progressColor, background: progressBg,
                        whiteSpace: "nowrap",
                      }}>
                        {progressLabel}
                      </div>

                      {/* Verified badge */}
                      {topic.verified ? (
                        <span style={{ fontSize: 10, color: D.green, fontFamily: FONTS.body }} title="Verified">✓</span>
                      ) : (
                        <span style={{ fontSize: 10, color: D.gold, fontFamily: FONTS.body }} title="AI-inferred">AI</span>
                      )}

                      {/* Expand arrow */}
                      <span style={{ color: D.textLow, fontSize: 12, transition: "transform 0.2s", transform: isExpanded ? "rotate(90deg)" : "none" }}>
                        ›
                      </span>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div style={{ padding: "0 16px 14px 52px", borderTop: `0.5px solid ${D.border}` }}>
                        {/* Prerequisites */}
                        {topic.prerequisiteIds && topic.prerequisiteIds.length > 0 && (
                          <div style={{ marginTop: 10, marginBottom: 10 }}>
                            <span style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.body, fontWeight: 600 }}>
                              Prerequisites:
                            </span>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                              {topic.prerequisiteIds.map((pid) => {
                                const prereq = topics.find((t) => t.id === pid);
                                return prereq ? (
                                  <span key={pid} style={{
                                    fontSize: 10, color: D.blue, background: "rgba(79,142,247,0.1)",
                                    padding: "2px 8px", borderRadius: 8, fontFamily: FONTS.body,
                                  }}>
                                    {prereq.title}
                                  </span>
                                ) : null;
                              })}
                            </div>
                          </div>
                        )}

                        {/* FSRS details */}
                        {p && p.totalItems > 0 && (
                          <div style={{ marginBottom: 10, fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
                            {p.totalItems} review items · Avg stability: {p.avgStability} · Retrievability: {Math.round(p.avgRetrievability * 100)}% · {p.masteredCount} mastered
                          </div>
                        )}

                        {/* Matched documents */}
                        {topicMatches.length > 0 && (
                          <div style={{ marginBottom: 10 }}>
                            <span style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.body, fontWeight: 600 }}>
                              Matched documents ({topicMatches.length}):
                            </span>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                              {topicMatches.map((m) => (
                                <div key={m.id} style={{
                                  display: "flex", alignItems: "center", gap: 8,
                                  padding: "6px 10px", background: D.ink, borderRadius: 6,
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
                                      onClick={(e) => { e.stopPropagation(); onOpenResource(m.resource.shareToken); }}
                                      style={{
                                        background: "none", border: `0.5px solid ${D.border}`, borderRadius: 4,
                                        padding: "2px 8px", fontSize: 10, color: D.blue, cursor: "pointer",
                                        fontFamily: FONTS.body,
                                      }}
                                    >
                                      Open
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Verification controls (only for AI-inferred topics) */}
                        {!topic.verified && topic.source !== "outline" && (
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCorroborate(topic.id); }}
                              style={{
                                background: "rgba(61,214,140,0.1)", border: `0.5px solid ${D.green}44`,
                                borderRadius: 6, padding: "5px 12px", fontSize: 11, color: D.green,
                                cursor: "pointer", fontFamily: FONTS.body, fontWeight: 600,
                              }}
                            >
                              ✓ Corroborate
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDispute(topic.id); }}
                              style={{
                                background: "rgba(255,84,112,0.1)", border: `0.5px solid ${D.coral}44`,
                                borderRadius: 6, padding: "5px 12px", fontSize: 11, color: D.coral,
                                cursor: "pointer", fontFamily: FONTS.body, fontWeight: 600,
                              }}
                            >
                              ✗ Dispute
                            </button>
                            <span style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.body, alignSelf: "center" }}>
                              {topic.corroboratingUserIds?.length || 0} corroborations · {topic.disputeUserIds?.length || 0} disputes
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 18, fontWeight: 700, color, fontFamily: FONTS.display }}>{value}</span>
      <span style={{ fontSize: 10, color: D.textMid, fontFamily: FONTS.body }}>{label}</span>
    </div>
  );
}
