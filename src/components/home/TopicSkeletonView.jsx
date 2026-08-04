import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { extractFileText } from "../../lib/extractFileText";
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

/**
 * Compute progress percentage for a topic from FSRS stats.
 */
function progressPct(p) {
  if (!p || p.totalItems === 0) return 0;
  return Math.round((p.avgRetrievability || 0) * 100);
}

/**
 * Check if a topic is locked (has unmet prerequisites).
 * A prerequisite is met if its progress label is "Mastered".
 */
function isTopicLocked(topic, topics, progress) {
  if (!topic.prerequisiteIds || topic.prerequisiteIds.length === 0) return false;
  for (const pid of topic.prerequisiteIds) {
    const prereq = topics.find((t) => t.id === pid);
    if (!prereq) continue;
    const prereqProgress = progress?.[pid];
    if (!prereqProgress || prereqProgress.label !== "Mastered") return true;
  }
  return false;
}

/**
 * Find the "Start here" topic — the first topic that:
 * (a) has no unmet prerequisites,
 * (b) is not yet mastered,
 * (c) has material mapped to it (if any matches exist).
 * If no topic with material matches, falls back to first unlocked non-mastered topic.
 */
function findStartHereTopic(topics, progress, matchesByTopic) {
  const hasMatches = matchesByTopic.size > 0;

  // First pass: prefer topics with material that are unlocked and not mastered
  if (hasMatches) {
    for (const topic of topics) {
      const p = progress?.[topic.id];
      const isMastered = p?.label === "Mastered";
      const locked = isTopicLocked(topic, topics, progress);
      const hasMaterial = matchesByTopic.has(topic.id);
      if (!isMastered && !locked && hasMaterial) return topic;
    }
  }

  // Second pass: first unlocked non-mastered topic
  for (const topic of topics) {
    const p = progress?.[topic.id];
    const isMastered = p?.label === "Mastered";
    const locked = isTopicLocked(topic, topics, progress);
    if (!isMastered && !locked) return topic;
  }

  return null;
}

export default function TopicSkeletonView({ courseCode: initialCourseCode, onExit, onOpenResource, onStartStudying }) {
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
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [outlineFileName, setOutlineFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

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

  const startHereTopic = useMemo(() => {
    if (topics.length === 0) return null;
    return findStartHereTopic(topics, progress, matchesByTopic);
  }, [topics, progress, matchesByTopic]);

  const selectedTopic = useMemo(() => {
    if (!selectedTopicId) return null;
    return topics.find((t) => t.id === selectedTopicId) || null;
  }, [selectedTopicId, topics]);

  // Auto-select first topic (or start-here topic) when topics load
  useEffect(() => {
    if (topics.length > 0 && !selectedTopicId) {
      const start = findStartHereTopic(topics, progress, matchesByTopic);
      setSelectedTopicId(start?.id || topics[0].id);
    }
    if (topics.length === 0) {
      setSelectedTopicId(null);
    }
  }, [topics, progress, matchesByTopic, selectedTopicId]);

  async function handleGenerate(outlineText) {
    if (!selectedCourse.trim()) return;
    setGenerating(true);
    setError("");
    const hasOutline = outlineText && outlineText.trim().length > 50;
    setGenProgress(hasOutline ? "Extracting topics from syllabus…" : "Generating topic skeleton with AI…");
    try {
      const result = await generateSkeleton({
        courseName: selectedCourse,
        outlineText: hasOutline ? outlineText : undefined,
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
      setOutlineFileName("");
      setTimeout(() => setGenProgress(""), 3000);
    }
  }

  async function handleOutlineUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !selectedCourse.trim() || generating) return;
    setUploading(true);
    setOutlineFileName(file.name);
    setGenProgress(`Extracting text from ${file.name}…`);
    try {
      const { text } = await extractFileText(file);
      if (!text || text.trim().length < 50) {
        setError("Could not extract enough text from the file. Try a different file or use Build Roadmap without an outline.");
        setOutlineFileName("");
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      setUploading(false);
      await handleGenerate(text);
    } catch (err) {
      setError(`Failed to extract text: ${err.message}`);
      setOutlineFileName("");
      setUploading(false);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
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
            Course Roadmap
          </div>
          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
            {selectedCourse || "Select a course"} · {topics.length} topics
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
            {matchProgress ? `${matchProgress.label}` : "🔗 Match Docs"}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.txt"
          style={{ display: "none" }}
          onChange={handleOutlineUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={generating || uploading || !selectedCourse.trim()}
          title="Upload a course syllabus/outline for higher-quality generation"
          style={{
            background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 8,
            padding: "8px 12px", fontSize: 14, color: D.blue,
            cursor: (generating || uploading) ? "not-allowed" : "pointer",
            fontFamily: FONTS.body, whiteSpace: "nowrap",
          }}
        >
          📎
        </button>

        <button onClick={() => handleGenerate()} disabled={generating || uploading || !selectedCourse.trim()} style={{
          background: generating ? "rgba(245,166,35,0.15)" : "linear-gradient(135deg, #b8860b, #F5A623)",
          border: "none", borderRadius: 8, padding: "8px 16px",
          fontSize: 12, fontWeight: 600, color: generating ? D.gold : "#0a0a0a",
          cursor: (generating || uploading) ? "not-allowed" : "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap",
        }}>
          {generating ? "Generating…" : topics.length > 0 ? "Regenerate" : "Build Roadmap"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "8px 20px", background: "rgba(255,84,112,0.1)", borderBottom: `0.5px solid ${D.coral}33`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: D.coral, fontFamily: FONTS.body }}>{error}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleGenerate} disabled={generating} style={{
              background: "rgba(255,84,112,0.15)", border: `0.5px solid ${D.coral}44`, borderRadius: 6,
              padding: "3px 10px", fontSize: 11, color: D.coral, cursor: "pointer", fontFamily: FONTS.body,
            }}>Retry</button>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: D.coral, cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
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

      {/* Body — two-column layout: path/timeline + sticky detail panel */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex" }}>
        {loading ? (
          <div style={{ flex: 1, textAlign: "center", padding: "60px 0", color: D.textMid, fontSize: 14, fontFamily: FONTS.body }}>
            Loading skeleton…
          </div>
        ) : topics.length === 0 ? (
          /* B2: Guided empty state onboarding */
          <div style={{ flex: 1, overflowY: "auto", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>�️</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: D.textHi, marginBottom: 8, fontFamily: FONTS.display }}>
              {selectedCourse ? `No roadmap for ${selectedCourse}` : "Select a course to begin"}
            </div>
            <div style={{ fontSize: 13, color: D.textMid, fontFamily: FONTS.body, lineHeight: 1.6, marginBottom: 28, textAlign: "center", maxWidth: 400 }}>
              Build a personalized learning roadmap from your course syllabus or let AI generate one.
            </div>

            {/* Step-by-step guide */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 440, width: "100%" }}>
              {/* Step 1: Upload syllabus */}
              <OnboardingStep
                number={1}
                title="Upload your course syllabus (optional)"
                description="PDF, DOCX, or TXT — AI extracts topics directly from it"
                icon="📎"
                done={outlineFileName !== ""}
                actionLabel={outlineFileName || "Choose File"}
                onAction={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                disabled={!selectedCourse.trim() || generating || uploading}
              />
              {/* Step 2: Enter course name */}
              <OnboardingStep
                number={2}
                title="Enter or select a course code"
                description="Type a course code or pick from your folders"
                icon="📚"
                done={!!selectedCourse.trim()}
                actionLabel={selectedCourse || "Type a course above ↑"}
                onAction={null}
                disabled={true}
              />
              {/* Step 3: Build roadmap */}
              <OnboardingStep
                number={3}
                title="Build your roadmap"
                description="AI generates an ordered topic skeleton with prerequisites"
                icon="✨"
                done={false}
                actionLabel={generating ? "Generating…" : "Build Roadmap →"}
                onAction={(e) => { e.stopPropagation(); handleGenerate(); }}
                disabled={!selectedCourse.trim() || generating || uploading}
                highlight={true}
              />
            </div>
          </div>
        ) : (
          <>
            {/* Left column — Topic path/timeline */}
            <div style={{
              flex: "1 1 45%", overflowY: "auto", padding: "16px 12px 16px 20px",
              borderRight: `0.5px solid ${D.border}`,
            }}>
              {/* Stats summary */}
              {stats && (
                <div style={{
                  background: D.panel, border: `0.5px solid ${D.border}`,
                  borderRadius: 12, padding: "14px 16px", marginBottom: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>Overall Mastery</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: D.gold, fontFamily: FONTS.display }}>{masteredPct}%</span>
                  </div>
                  <div style={{ height: 6, background: D.ink, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${masteredPct}%`, background: `linear-gradient(90deg, ${D.gold}, ${D.green})`, borderRadius: 3, transition: "width 0.3s" }} />
                  </div>
                  <div style={{ display: "flex", gap: 14, marginTop: 10 }}>
                    <StatItem label="Mastered" value={stats.mastered} color={D.green} />
                    <StatItem label="Learning" value={stats.learning} color={D.gold} />
                    <StatItem label="Not Started" value={stats.notStarted} color={D.textLow} />
                  </div>
                </div>
              )}

              {/* Start here banner */}
              {startHereTopic && (
                <div onClick={() => setSelectedTopicId(startHereTopic.id)} style={{
                  background: `linear-gradient(135deg, rgba(245,166,35,0.15), rgba(245,166,35,0.05))`,
                  border: `1px solid ${D.gold}44`, borderRadius: 10, padding: "12px 16px",
                  marginBottom: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                }}>
                  <span style={{ fontSize: 20 }}>👉</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: D.gold, fontFamily: FONTS.mono, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>
                      Start Here
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: D.textHi, fontFamily: FONTS.body, marginTop: 2 }}>
                      {startHereTopic.title}
                    </div>
                  </div>
                  <span style={{ color: D.gold, fontSize: 14 }}>→</span>
                </div>
              )}

              {/* Timeline topic list */}
              <div style={{ position: "relative", paddingLeft: 20 }}>
                {/* Vertical connecting line */}
                <div style={{
                  position: "absolute", left: 9, top: 8, bottom: 8, width: 2,
                  background: `linear-gradient(to bottom, ${D.border}, ${D.border}, ${D.border})`,
                }} />

                {topics.map((topic, idx) => {
                  const p = progress?.[topic.id];
                  const topicMatches = matchesByTopic.get(topic.id) || [];
                  const isSelected = selectedTopicId === topic.id;
                  const isStartHere = startHereTopic?.id === topic.id;
                  const progressLabel = p?.label || "Not started";
                  const progressColor = PROGRESS_COLORS[progressLabel] || D.textLow;
                  const locked = isTopicLocked(topic, topics, progress);
                  const pct = progressPct(p);
                  const dotColor = locked ? D.textLow : progressLabel === "Mastered" ? D.green : isStartHere ? D.gold : progressLabel === "Not started" ? D.textLow : progressColor;

                  return (
                    <div
                      key={topic.id}
                      onClick={() => !locked && setSelectedTopicId(topic.id)}
                      style={{
                        position: "relative", display: "flex", alignItems: "flex-start", gap: 12,
                        padding: "10px 12px", marginBottom: 4, borderRadius: 8, cursor: locked ? "default" : "pointer",
                        background: isSelected ? "rgba(245,166,35,0.08)" : "transparent",
                        border: isSelected ? `0.5px solid ${D.gold}33` : "0.5px solid transparent",
                        transition: "background 0.15s, border-color 0.15s",
                        opacity: locked ? 0.45 : 1,
                      }}
                    >
                      {/* Timeline dot */}
                      <div style={{
                        position: "absolute", left: -16, top: 14, width: 12, height: 12, borderRadius: "50%",
                        background: D.ink, border: `2px solid ${dotColor}`,
                        boxShadow: isStartHere ? `0 0 8px ${D.gold}66` : "none",
                        flexShrink: 0, zIndex: 1,
                      }} />

                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 12, color: D.textLow, fontFamily: FONTS.mono, flexShrink: 0 }}>
                            {topic.displayOrder || idx + 1}
                          </span>
                          <span style={{
                            fontSize: 13, fontWeight: 600, fontFamily: FONTS.body,
                            color: locked ? D.textLow : D.textHi, flex: 1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {topic.title}
                          </span>
                          {/* B5: Quick-study icon for unlocked topics with docs */}
                          {!locked && topicMatches.length > 0 && onStartStudying && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onStartStudying(topic); }}
                              title="Study this topic now"
                              style={{
                                background: "rgba(245,166,35,0.12)", border: `0.5px solid ${D.gold}33`,
                                borderRadius: 6, padding: "2px 8px", fontSize: 10, color: D.gold,
                                cursor: "pointer", fontFamily: FONTS.body, fontWeight: 600, flexShrink: 0,
                                opacity: isSelected ? 1 : 0.7,
                              }}
                            >
                              ▶
                            </button>
                          )}
                        </div>

                        {/* Progress bar */}
                        <div style={{ height: 3, background: D.ink, borderRadius: 2, overflow: "hidden", marginTop: 6, marginRight: 40 }}>
                          <div style={{
                            height: "100%", width: `${pct}%`,
                            background: progressLabel === "Mastered" ? D.green : progressColor,
                            borderRadius: 2, transition: "width 0.3s",
                          }} />
                        </div>

                        {/* Badges row */}
                        <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                          {isStartHere && (
                            <Badge text="Start" bg="rgba(245,166,35,0.15)" color={D.gold} />
                          )}
                          {progressLabel === "Mastered" && (
                            <Badge text="✓ Done" bg="rgba(61,214,140,0.12)" color={D.green} />
                          )}
                          {locked && (
                            <Badge text="🔒 Locked" bg="rgba(86,94,110,0.15)" color={D.textLow} />
                          )}
                          {topicMatches.length > 0 && (
                            <Badge text={`${topicMatches.length} docs`} bg="rgba(79,142,247,0.1)" color={D.blue} />
                          )}
                          {topic.status === "disputed" && (
                            <Badge text="⚠ Disputed" bg="rgba(255,84,112,0.1)" color={D.coral} />
                          )}
                          {topic.source === "outline" ? (
                            <Badge text="Outline" bg="rgba(61,214,140,0.08)" color={D.green} />
                          ) : topic.source === "ai_added" ? (
                            <Badge text="AI Added" bg="rgba(245,166,35,0.08)" color={D.gold} />
                          ) : (
                            <Badge text="AI" bg="rgba(245,166,35,0.06)" color={D.textMid} />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right column — Sticky detail panel */}
            <div style={{
              flex: "1 1 55%", overflowY: "auto", padding: "20px",
            }}>
              {selectedTopic ? (
                <TopicDetailPanel
                  topic={selectedTopic}
                  topics={topics}
                  progress={progress?.[selectedTopic.id]}
                  matches={matchesByTopic.get(selectedTopic.id) || []}
                  onOpenResource={onOpenResource}
                  onStartStudying={onStartStudying}
                  onCorroborate={handleCorroborate}
                  onDispute={handleDispute}
                  locked={isTopicLocked(selectedTopic, topics, progress)}
                  isStartHere={startHereTopic?.id === selectedTopic.id}
                />
              ) : (
                <div style={{ textAlign: "center", padding: "60px 20px", color: D.textMid, fontSize: 13, fontFamily: FONTS.body }}>
                  Select a topic from the path to see details
                </div>
              )}
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
      <span style={{ fontSize: 16, fontWeight: 700, color, fontFamily: FONTS.display }}>{value}</span>
      <span style={{ fontSize: 9, color: D.textMid, fontFamily: FONTS.body }}>{label}</span>
    </div>
  );
}

function Badge({ text, bg, color }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, fontFamily: FONTS.body, color,
      background: bg, padding: "2px 7px", borderRadius: 8, whiteSpace: "nowrap",
    }}>
      {text}
    </span>
  );
}

function TopicDetailPanel({ topic, topics, progress, matches, onOpenResource, onStartStudying, onCorroborate, onDispute, locked, isStartHere }) {
  const p = progress;
  const progressLabel = p?.label || "Not started";
  const progressColor = PROGRESS_COLORS[progressLabel] || D.textLow;
  const pct = progressPct(p);

  // B3: Estimated study time — 5 min per subtopic + 10 min per document
  const subtopicCount = (topic.subtopics?.length || 0);
  const estMinutes = (subtopicCount * 5) + (matches.length * 10);
  const estTimeStr = estMinutes >= 60 ? `${Math.floor(estMinutes / 60)}h ${estMinutes % 60}m` : `~${estMinutes}m`;

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

        {/* B3: Estimated study time */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
          <span style={{ fontSize: 12 }}>⏱️</span>
          <span>Estimated study time: <strong style={{ color: D.gold }}>{estTimeStr}</strong></span>
          <span style={{ color: D.textLow, fontSize: 10 }}>({subtopicCount} subtopics · {matches.length} docs)</span>
        </div>
      </div>

      {/* Section 2: Action buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        {locked ? (
          <div style={{
            flex: 1, textAlign: "center", padding: "12px", background: "rgba(86,94,110,0.1)",
            border: `0.5px solid ${D.border}`, borderRadius: 8,
            fontSize: 12, color: D.textLow, fontFamily: FONTS.body,
          }}>
            🔒 Locked — complete prerequisites first
          </div>
        ) : (
          <>
            {matches.length > 0 && onStartStudying && (
              <button
                onClick={() => onStartStudying(topic)}
                style={{
                  flex: 1, background: "linear-gradient(135deg, #b8860b, #F5A623)", border: "none",
                  borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600,
                  color: "#0a0a0a", cursor: "pointer", fontFamily: FONTS.body,
                }}
              >
                Start Studying →
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
                    onClick={() => onOpenResource(m.resource.shareToken)}
                    style={{
                      background: "none", border: `0.5px solid ${D.border}`, borderRadius: 4,
                      padding: "3px 10px", fontSize: 10, color: D.blue, cursor: "pointer",
                      fontFamily: FONTS.body,
                    }}
                  >
                    Open
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 5: Prerequisite chain (last) */}
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

function OnboardingStep({ number, title, description, icon, done, actionLabel, onAction, disabled, highlight }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "14px 16px", borderRadius: 12,
      background: highlight ? "rgba(245,166,35,0.06)" : D.panel,
      border: done ? `0.5px solid ${D.green}33` : highlight ? `0.5px solid ${D.gold}33` : `0.5px solid ${D.border}`,
      transition: "border-color 0.2s, background 0.2s",
    }}>
      {/* Step number / done check */}
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

      {/* Text content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: D.textHi, fontFamily: FONTS.body, display: "flex", alignItems: "center", gap: 6 }}>
          <span>{icon}</span>
          <span>{title}</span>
        </div>
        <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body, marginTop: 2 }}>
          {description}
        </div>
      </div>

      {/* Action button */}
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
