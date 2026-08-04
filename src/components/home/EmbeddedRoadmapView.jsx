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
import { extractFileText } from "../../lib/extractFileText";
import { FONTS } from "../../lib/theme";
import {
  D, isTopicLocked, findStartHereTopic,
  StatItem, TopicDetailPanel, OnboardingStep, TimelineTopicRow,
} from "./roadmapShared";

const FILE_TYPES = ["pdf", "docx", "pptx", "txt", "image", "doc", "note", "tutorial_question"];

export default function EmbeddedRoadmapView({
  courseCode,
  folderId,
  folderResources,
  onOpenResource,
  onStartStudying,
}) {
  const [topics, setTopics] = useState([]);
  const [progress, setProgress] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [error, setError] = useState("");
  const [matchProgress, setMatchProgress] = useState(null);
  const [selectedTopicId, setSelectedTopicId] = useState(null);
  const [outlineFileName, setOutlineFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const loadData = useCallback(async () => {
    if (!courseCode) { setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const t = await fetchSkeleton(courseCode);
      setTopics(t);
      if (t.length > 0) {
        const [prog, mtch] = await Promise.all([
          fetchTopicProgress(courseCode),
          fetchTopicMatches(courseCode),
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
  }, [courseCode]);

  useEffect(() => { loadData(); }, [loadData]);

  const matchesByTopic = useMemo(() => {
    const map = new Map();
    for (const m of matches) {
      if (!map.has(m.topicId)) map.set(m.topicId, []);
      map.get(m.topicId).push(m);
    }
    return map;
  }, [matches]);

  const matchedResourceIds = useMemo(() => {
    const ids = new Set();
    for (const m of matches) ids.add(m.resourceId);
    return ids;
  }, [matches]);

  const unsortedFiles = useMemo(() => {
    return folderResources.filter(
      (r) => FILE_TYPES.includes(r.contentType) && !r.sourceResourceId && !matchedResourceIds.has(r.id)
    );
  }, [folderResources, matchedResourceIds]);

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

  useEffect(() => {
    if (topics.length > 0 && !selectedTopicId) {
      const start = findStartHereTopic(topics, progress, matchesByTopic);
      setSelectedTopicId(start?.id || topics[0].id);
    }
    if (topics.length === 0) setSelectedTopicId(null);
  }, [topics, progress, matchesByTopic, selectedTopicId]);

  async function handleGenerate(outlineText) {
    if (!courseCode.trim()) return;
    setGenerating(true);
    setError("");
    const hasOutline = outlineText && outlineText.trim().length > 50;
    setGenProgress(hasOutline ? "Extracting topics from syllabus…" : "Generating topic skeleton with AI…");
    try {
      const result = await generateSkeleton({
        courseName: courseCode,
        outlineText: hasOutline ? outlineText : undefined,
        onProgress: setGenProgress,
      });
      setTopics(result.topics);
      setGenProgress(`Generated ${result.topics.length} topics ✓`);
      const [prog, mtch] = await Promise.all([
        fetchTopicProgress(courseCode),
        fetchTopicMatches(courseCode),
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
    if (!file || !courseCode.trim() || generating) return;
    setUploading(true);
    setOutlineFileName(file.name);
    setGenProgress(`Extracting text from ${file.name}…`);
    try {
      const { text } = await extractFileText(file);
      if (!text || text.trim().length < 50) {
        setError("Could not extract enough text from the file. Try a different file.");
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
    if (!courseCode.trim()) return;
    setMatchProgress({ current: 0, total: 0, label: "Starting…" });
    try {
      const result = await retroactiveMatch(courseCode, (idx, total, name) => {
        setMatchProgress({ current: idx, total, label: name });
      }, folderId);
      setMatchProgress({ current: result.resourceCount, total: result.resourceCount, label: `Done — ${result.matchCount} matches` });
      const mtch = await fetchTopicMatches(courseCode);
      setMatches(mtch);
      setTimeout(() => setMatchProgress(null), 3000);
    } catch (err) {
      setError(err.message);
      setMatchProgress(null);
    }
  }

  async function handleCorroborate(topicId) {
    try { await corroborateTopic(topicId); loadData(); } catch (err) { setError(err.message); }
  }

  async function handleDispute(topicId) {
    try { await disputeTopic(topicId); loadData(); } catch (err) { setError(err.message); }
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 0", color: D.textMid, fontSize: 14, fontFamily: FONTS.body }}>
        Loading roadmap…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap",
        padding: "10px 0", marginBottom: 4,
      }}>
        <div style={{ flex: 1, minWidth: 120 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
            Roadmap
          </span>
          <span style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body, marginLeft: 8 }}>
            {topics.length} topics · {stats?.mastered || 0} mastered
          </span>
        </div>

        {topics.length > 0 && (
          <button onClick={handleRetroactiveMatch} disabled={!!matchProgress} style={{
            background: D.panel, border: `0.5px solid ${D.blue}`, borderRadius: 8,
            padding: "6px 12px", fontSize: 11, color: D.blue, cursor: matchProgress ? "not-allowed" : "pointer",
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

        <button onClick={() => topics.length > 0 ? setShowRegenPrompt(true) : fileInputRef.current?.click()} disabled={generating || uploading} style={{
          background: generating ? "rgba(245,166,35,0.15)" : "linear-gradient(135deg, #b8860b, #F5A623)",
          border: "none", borderRadius: 8, padding: "6px 14px",
          fontSize: 11, fontWeight: 600, color: generating ? D.gold : "#0a0a0a",
          cursor: (generating || uploading) ? "not-allowed" : "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap",
        }}>
          {generating ? "…" : topics.length > 0 ? "Regenerate" : "Build Roadmap"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "8px 14px", background: "rgba(255,84,112,0.1)", borderRadius: 8, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: D.coral, fontFamily: FONTS.body }}>{error}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleGenerate()} disabled={generating} style={{
              background: "rgba(255,84,112,0.15)", border: `0.5px solid ${D.coral}44`, borderRadius: 6,
              padding: "3px 10px", fontSize: 11, color: D.coral, cursor: "pointer", fontFamily: FONTS.body,
            }}>Retry</button>
            <button onClick={() => setError("")} style={{ background: "none", border: "none", color: D.coral, cursor: "pointer", fontSize: 14 }}>×</button>
          </div>
        </div>
      )}

      {/* Progress messages */}
      {(genProgress || matchProgress) && (
        <div style={{ padding: "8px 14px", background: "rgba(245,166,35,0.08)", borderRadius: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: D.gold, fontFamily: FONTS.body }}>
            {genProgress || (matchProgress ? `${matchProgress.label} (${matchProgress.current}/${matchProgress.total})` : "")}
          </span>
        </div>
      )}

      {/* Regenerate prompt */}
      {showRegenPrompt && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100, background: "rgba(7,9,13,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }} onClick={() => setShowRegenPrompt(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: `linear-gradient(160deg, ${D.panel}, ${D.ink})`,
            border: `0.5px solid ${D.gold}33`, borderRadius: 16, padding: 28,
            maxWidth: 420, width: "100%", textAlign: "center",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔄</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display, marginBottom: 6 }}>
              Regenerate Roadmap
            </div>
            <div style={{ fontSize: 12, color: D.textMid, fontFamily: FONTS.body, lineHeight: 1.5, marginBottom: 20 }}>
              Upload your course outline for a more accurate roadmap, or regenerate from AI.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={() => { setShowRegenPrompt(false); fileInputRef.current?.click(); }} style={{
                background: "linear-gradient(135deg, #b8860b, #F5A623)", border: "none", borderRadius: 10,
                padding: "12px 20px", fontSize: 13, fontWeight: 600, color: "#0a0a0a",
                cursor: "pointer", fontFamily: FONTS.body,
              }}>
                📎 Upload Course Outline
              </button>
              <button onClick={() => { setShowRegenPrompt(false); handleGenerate(); }} style={{
                background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 10,
                padding: "12px 20px", fontSize: 13, fontWeight: 500, color: D.textMid,
                cursor: "pointer", fontFamily: FONTS.body,
              }}>
                ✨ Generate without outline
              </button>
              <button onClick={() => setShowRegenPrompt(false)} style={{
                background: "none", border: "none", color: D.textLow, cursor: "pointer",
                fontSize: 12, fontFamily: FONTS.body, padding: "4px",
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      {topics.length === 0 ? (
        /* Empty state — onboarding */
        <div style={{ padding: "24px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🗺️</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: D.textHi, marginBottom: 8, fontFamily: FONTS.display }}>
            No roadmap for {courseCode} yet
          </div>
          <div style={{ fontSize: 13, color: D.textMid, fontFamily: FONTS.body, lineHeight: 1.6, marginBottom: 28, textAlign: "center", maxWidth: 400 }}>
            Build a personalized learning roadmap from your course syllabus or let AI generate one.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 440, width: "100%" }}>
            <OnboardingStep
              number={1}
              title="Upload your course syllabus (optional)"
              description="PDF, DOCX, or TXT — AI extracts topics directly from it"
              icon="📎"
              done={outlineFileName !== ""}
              actionLabel={outlineFileName || "Choose File"}
              onAction={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              disabled={generating || uploading}
            />
            <OnboardingStep
              number={2}
              title="Course code"
              description={courseCode}
              icon="📚"
              done={!!courseCode.trim()}
              actionLabel={courseCode}
              onAction={null}
              disabled={true}
            />
            <OnboardingStep
              number={3}
              title="Build your roadmap"
              description="AI generates an ordered topic skeleton with prerequisites"
              icon="✨"
              done={false}
              actionLabel={generating ? "Generating…" : "Build Roadmap →"}
              onAction={(e) => { e.stopPropagation(); handleGenerate(); }}
              disabled={!courseCode.trim() || generating || uploading}
              highlight={true}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 0, minHeight: 400 }}>
          {/* Left — Timeline */}
          <div style={{
            flex: isMobile ? (showDetailMobile ? "0 0 auto" : "1 1 auto") : "1 1 45%",
            display: isMobile && showDetailMobile ? "none" : "block",
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
              <div onClick={() => { setSelectedTopicId(startHereTopic.id); if (isMobile) setShowDetailMobile(true); }} style={{
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
              <div style={{
                position: "absolute", left: 9, top: 8, bottom: 8, width: 2,
                background: `linear-gradient(to bottom, ${D.border}, ${D.border}, ${D.border})`,
              }} />
              {topics.map((topic, idx) => (
                <TimelineTopicRow
                  key={topic.id}
                  topic={topic}
                  idx={idx}
                  topics={topics}
                  progress={progress}
                  matchesByTopic={matchesByTopic}
                  selectedTopicId={selectedTopicId}
                  startHereTopic={startHereTopic}
                  onSelectTopic={(id) => { setSelectedTopicId(id); if (isMobile) setShowDetailMobile(true); }}
                  onStartStudying={onStartStudying}
                  isMobile={isMobile}
                />
              ))}
            </div>

            {/* Unsorted bucket */}
            {unsortedFiles.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{
                  fontSize: 11, color: D.textLow, fontFamily: FONTS.body, fontWeight: 600,
                  marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  📦 Unsorted ({unsortedFiles.length})
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {unsortedFiles.map((file) => (
                    <div key={file.id} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 12px", background: D.panel, borderRadius: 8,
                      border: `0.5px solid ${D.border}`,
                    }}>
                      <span style={{ fontSize: 11, color: D.textHi, fontFamily: FONTS.body, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {file.title}
                      </span>
                      <span style={{ fontSize: 9, color: D.textLow, fontFamily: FONTS.body }}>
                        {file.contentType}
                      </span>
                      {file.shareToken && onOpenResource && (
                        <button
                          onClick={() => onOpenResource(file.shareToken)}
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
                <button onClick={handleRetroactiveMatch} disabled={!!matchProgress} style={{
                  marginTop: 10, background: D.panel, border: `0.5px solid ${D.blue}44`, borderRadius: 8,
                  padding: "8px 16px", fontSize: 11, color: D.blue, cursor: matchProgress ? "not-allowed" : "pointer",
                  fontFamily: FONTS.body, fontWeight: 600,
                }}>
                  {matchProgress ? "Matching…" : "🔗 Match Unsorted to Topics"}
                </button>
              </div>
            )}
          </div>

          {/* Right — Detail panel */}
          <div style={{
            flex: isMobile ? "1 1 auto" : "1 1 55%",
            paddingLeft: isMobile ? 0 : 16,
            display: isMobile && !showDetailMobile ? "none" : "block",
          }}>
            {isMobile && showDetailMobile && (
              <button onClick={() => setShowDetailMobile(false)} style={{
                background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 8,
                padding: "6px 12px", fontSize: 11, color: D.textMid, cursor: "pointer",
                fontFamily: FONTS.body, marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
              }}>
                ← Back to list
              </button>
            )}
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
        </div>
      )}
    </div>
  );
}
