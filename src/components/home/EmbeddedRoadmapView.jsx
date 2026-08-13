import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  fetchSkeleton,
  fetchTopicProgress,
  fetchTopicMatches,
  generateSkeleton,
  reorderTopics,
} from "../../lib/skeletonGenerator";
import { retroactiveMatch } from "../../lib/topicMatcher";
import { extractFileText } from "../../lib/extractFileText";
import { FONTS } from "../../lib/theme";
import {
  D, isTopicLocked, findStartHereTopic,
  TopicDetailPanel, OnboardingStep, TimelineTopicRow,
} from "./roadmapShared";

const RING_SIZE = 104;
const RING_STROKE = 9;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_RADIUS;

const FILE_TYPES = ["pdf", "docx", "pptx", "txt", "image", "doc", "note", "tutorial_question"];

export default function EmbeddedRoadmapView({
  courseCode,
  folderId,
  folderResources,
  onOpenResource,
  onStartStudying,
  onGenerate,
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
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState(null);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);
  const dragStateRef = useRef(null);

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

  // Refresh progress when user returns from a practice session
  useEffect(() => {
    const handlePracticeComplete = () => {
      if (courseCode) {
        fetchTopicProgress(courseCode).then(setProgress).catch(() => {});
      }
    };
    window.addEventListener("sc-practice-complete", handlePracticeComplete);
    return () => window.removeEventListener("sc-practice-complete", handlePracticeComplete);
  }, [courseCode]);

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

  // Build a map of resourceId -> variants for quick lookup in TopicDetailPanel
  const resourceVariantsMap = useMemo(() => {
    const map = new Map();
    for (const r of folderResources) {
      if (r.variants) map.set(r.id, r.variants);
    }
    return map;
  }, [folderResources]);

  // Build a map of resourceId -> full resource object (for onGenerate which needs fileName, folderId, etc.)
  const resourceByIdMap = useMemo(() => {
    const map = new Map();
    for (const r of folderResources) {
      map.set(r.id, r);
    }
    return map;
  }, [folderResources]);

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

  // Enrich onStartStudying with roadmap context (matches, subtopics, progress, prerequisites)
  const handleStartStudying = useCallback((topic) => {
    if (!topic) return;
    const topicMatches = matchesByTopic.get(topic.id) || [];
    const topicProgress = progress?.[topic.id] || null;
    const prerequisiteTitles = (topic.prerequisiteIds || [])
      .map(pid => topics.find(t => t.id === pid))
      .filter(Boolean)
      .map(t => t.title);
    const enriched = {
      title: topic.title,
      description: topic.description || "",
      subtopics: topic.subtopics || [],
      matches: topicMatches.map(m => ({
        title: m.resource?.title || "",
        contentType: m.resource?.contentType || "",
        subject: m.resource?.subject || "",
      })),
      progress: topicProgress ? {
        label: topicProgress.label,
        avgRetrievability: topicProgress.avgRetrievability || 0,
        totalItems: topicProgress.totalItems || 0,
        masteredCount: topicProgress.masteredCount || 0,
        avgStability: topicProgress.avgStability || 0,
      } : null,
      prerequisiteTitles,
    };
    onStartStudying(enriched);
  }, [matchesByTopic, progress, topics, onStartStudying]);

  useEffect(() => {
    if (topics.length > 0 && !selectedTopicId) {
      const start = findStartHereTopic(topics, progress, matchesByTopic);
      if (start) {
        setSelectedTopicId(start.id);
      } else {
        // findStartHereTopic returned null — find first topic with content (even if locked)
        const firstAccessible = topics.find((t) => {
          const isLocked = isTopicLocked(t, topics, progress);
          const hasDocs = matchesByTopic.has(t.id);
          return !isLocked || hasDocs;
        });
        if (firstAccessible) setSelectedTopicId(firstAccessible.id);
      }
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
    setMatchProgress({ current: 0, total: 0, label: "Matching documents…" });
    setError("");
    try {
      const result = await retroactiveMatch(courseCode, (idx, total, name) => {
        setMatchProgress({ current: idx, total, label: name });
      }, folderId);
      setMatchProgress({ current: result.resourceCount, total: result.resourceCount, label: `Done — ${result.matchCount} matches${result.errorCount ? ` (${result.errorCount} failed)` : ""}` });
      const mtch = await fetchTopicMatches(courseCode);
      setMatches(mtch);
      if (result.errorCount > 0 && result.matchCount > 0) {
        setError(`${result.errorCount} document(s) failed to match — the AI service may be slow. ${result.matchCount} were matched successfully.`);
      }
      setTimeout(() => setMatchProgress(null), 3000);
    } catch (err) {
      setError(err.message);
      setMatchProgress(null);
    }
  }

  function showToast(msg) {
    setToast(msg);
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => setToast(null), 1800);
  }

  function handleDragStart(e, topicId) {
    if (!editMode) return;
    const topic = topics.find(t => t.id === topicId);
    if (!topic || isTopicLocked(topic, topics, progress)) return;

    e.preventDefault();
    const row = e.currentTarget.closest('[data-topic-id]');
    if (!row) return;
    const rect = row.getBoundingClientRect();

    const placeholder = document.createElement('div');
    placeholder.className = 'cs-drag-placeholder';
    placeholder.style.height = rect.height + 'px';
    row.parentNode.insertBefore(placeholder, row.nextSibling);

    row.classList.add('cs-dragging');
    row.style.position = 'fixed';
    row.style.left = rect.left + 'px';
    row.style.top = rect.top + 'px';
    row.style.width = rect.width + 'px';
    row.style.zIndex = '999';

    dragStateRef.current = {
      row, placeholder, topicId,
      startY: e.clientY,
      origTop: rect.top,
      height: rect.height,
    };

    if (navigator.vibrate) navigator.vibrate(10);
    document.addEventListener('pointermove', handleDragMove);
    document.addEventListener('pointerup', handleDragEnd);
  }

  function handleDragMove(e) {
    const ds = dragStateRef.current;
    if (!ds) return;
    const dy = e.clientY - ds.startY;
    ds.row.style.top = (ds.origTop + dy) + 'px';

    const margin = 60;
    if (e.clientY < margin) {
      window.scrollBy(0, -8);
    } else if (e.clientY > window.innerHeight - margin) {
      window.scrollBy(0, 8);
    }

    const listEl = listRef.current;
    if (!listEl) return;
    const rows = [...listEl.querySelectorAll('[data-topic-id]:not(.cs-dragging)')];
    let target = null;
    for (const r of rows) {
      const rr = r.getBoundingClientRect();
      if (e.clientY > rr.top && e.clientY < rr.bottom) { target = r; break; }
    }
    if (target) {
      const tId = target.getAttribute('data-topic-id');
      const tTopic = topics.find(t => String(t.id) === tId);
      if (tTopic && !isTopicLocked(tTopic, topics, progress)) {
        const rr = target.getBoundingClientRect();
        const before = e.clientY < rr.top + rr.height / 2;
        listEl.insertBefore(ds.placeholder, before ? target : target.nextSibling);
      }
    }
  }

  function handleDragEnd() {
    const ds = dragStateRef.current;
    if (!ds) return;

    const listEl = listRef.current;
    if (!listEl) { dragStateRef.current = null; return; }

    const children = [...listEl.children];
    const newOrderIds = children
      .map(c => c === ds.placeholder ? String(ds.topicId) : c.getAttribute('data-topic-id'))
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);

    const newTopics = newOrderIds.map(id => topics.find(t => String(t.id) === id)).filter(Boolean);

    ds.row.style.position = '';
    ds.row.style.left = '';
    ds.row.style.top = '';
    ds.row.style.width = '';
    ds.row.style.zIndex = '';
    ds.row.classList.remove('cs-dragging');
    ds.placeholder.remove();

    document.removeEventListener('pointermove', handleDragMove);
    document.removeEventListener('pointerup', handleDragEnd);
    dragStateRef.current = null;

    setTopics(newTopics);
    reorderTopics(courseCode, newOrderIds).catch(err => {
      console.error("Reorder failed:", err);
      showToast("Failed to save order");
    });
    showToast('Order saved');
    if (navigator.vibrate) navigator.vibrate(6);
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
      {/* Hidden file input — always rendered so ref is available in empty state */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt"
        style={{ display: "none" }}
        onChange={handleOutlineUpload}
      />

      {/* Roadmap header — section title + actions */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginTop: 28, marginBottom: 12,
      }}>
        <div>
          <span style={{ fontSize: 17, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
            Roadmap
          </span>
          <div style={{ fontSize: 12, color: D.textLow, fontFamily: FONTS.body, marginTop: 2 }}>
            {topics.length} topics · {stats?.mastered || 0} mastered
          </div>
        </div>

        {topics.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setEditMode(!editMode)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: editMode ? "linear-gradient(135deg, #F5A623, #E08E12)" : D.panel,
                border: editMode ? "none" : `1px solid ${D.border}`,
                borderRadius: 100, padding: "8px 14px",
                fontSize: 12, fontWeight: 700, fontFamily: FONTS.body,
                color: editMode ? "#1a1206" : D.textMid,
                cursor: "pointer", whiteSpace: "nowrap",
                transition: "all 0.25s ease",
              }}
            >
              {editMode ? "Done" : "✎ Edit order"}
            </button>

            <button onClick={handleRetroactiveMatch} disabled={!!matchProgress} style={{
              display: "flex", alignItems: "center", gap: 6,
              background: D.panel, border: `1px solid rgba(79,142,247,0.3)`,
              backdropFilter: "blur(14px)", borderRadius: 100,
              padding: "8px 12px", fontSize: 12, fontWeight: 600, color: D.blue,
              cursor: matchProgress ? "not-allowed" : "pointer",
              fontFamily: FONTS.body, whiteSpace: "nowrap",
            }}>
              {matchProgress ? `${matchProgress.label}` : "🔗 Match Docs"}
            </button>

            <button onClick={() => topics.length > 0 ? setShowRegenPrompt(true) : fileInputRef.current?.click()} disabled={generating || uploading} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34, borderRadius: 100, border: "none",
              background: generating ? "rgba(245,166,35,0.15)" : "linear-gradient(135deg, #F5A623, #E08E12)",
              color: generating ? D.gold : "#1a1206",
              cursor: (generating || uploading) ? "not-allowed" : "pointer",
              fontSize: 14, fontWeight: 600, fontFamily: FONTS.body,
            }}>
              {generating ? "⋯" : "↻"}
            </button>
          </div>
        )}
      </div>

      {/* Edit hint */}
      {topics.length > 0 && (
        <div className={`cs-edit-hint${editMode ? " active" : ""}`}>
          {editMode
            ? "Drag the handle to reorder. Locked topics can't be moved."
            : 'Tap "Edit order" to rearrange topics to match your course outline.'}
        </div>
      )}

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
            {/* Mastery card — circular ring + legend */}
            {stats && (
              <MasteryRing stats={stats} masteredPct={masteredPct} />
            )}

            {/* Start here banner — glass with gold accent */}
            {startHereTopic && (
              <div
                className="cs-start-banner"
                onClick={() => { setSelectedTopicId(startHereTopic.id); if (isMobile) setShowDetailMobile(true); }}
                style={{ marginBottom: 16 }}
              >
                <span style={{ fontSize: 20 }}>👉</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 10, color: D.gold, fontFamily: FONTS.mono, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600, display: "block", marginBottom: 3 }}>
                    Start Here
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
                    {startHereTopic.title}
                  </span>
                </div>
                <span style={{ color: D.gold, fontSize: 18, marginLeft: "auto" }}>→</span>
              </div>
            )}

            {/* Timeline topic list — connecting line + nodes */}
            <div
              ref={listRef}
              className={`cs-topic-list${editMode ? " cs-edit-mode" : ""}`}
              style={{ marginTop: 16 }}
            >
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
                  onStartStudying={handleStartStudying}
                  isMobile={isMobile}
                  isLast={idx === topics.length - 1}
                  editMode={editMode}
                  onDragStart={handleDragStart}
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
                onStartStudying={handleStartStudying}
                locked={isTopicLocked(selectedTopic, topics, progress)}
                isStartHere={startHereTopic?.id === selectedTopic.id}
                resourceVariantsMap={resourceVariantsMap}
                resourceByIdMap={resourceByIdMap}
                onGenerate={onGenerate}
              />
            ) : (
              <div style={{ textAlign: "center", padding: "60px 20px", color: D.textMid, fontSize: 13, fontFamily: FONTS.body }}>
                Select a topic from the path to see details
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="cs-toast show">
          <span className="cs-toast-dot" />
          {toast}
        </div>
      )}
    </div>
  );
}

function MasteryRing({ stats, masteredPct }) {
  const [offset, setOffset] = useState(RING_CIRC);
  const reducedMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  useEffect(() => {
    const target = RING_CIRC - (RING_CIRC * masteredPct) / 100;
    if (reducedMotion) {
      setOffset(target);
    } else {
      const timer = setTimeout(() => setOffset(target), 100);
      return () => clearTimeout(timer);
    }
  }, [masteredPct, reducedMotion]);

  return (
    <div style={{
      background: D.panel, border: `1px solid ${D.border}`,
      backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      borderRadius: 20, padding: 22, marginBottom: 16,
      display: "flex", alignItems: "center", gap: 20,
    }}>
      <div style={{ position: "relative", width: RING_SIZE, height: RING_SIZE, flexShrink: 0 }}>
        <svg width={RING_SIZE} height={RING_SIZE} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={RING_STROKE} />
          <circle className="cs-ring-fg" cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS}
            strokeDasharray={RING_CIRC} strokeDashoffset={offset} />
        </svg>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontFamily: FONTS.mono, fontSize: 19, fontWeight: 600, color: D.textHi }}>
            {masteredPct}%
          </span>
          <span style={{ fontSize: 9.5, color: D.textLow, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 1 }}>
            mastery
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 9, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: D.textMid }}>
            <span style={{ width: 8, height: 8, borderRadius: 100, background: D.green, flexShrink: 0 }} />
            Mastered
          </div>
          <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: D.textHi }}>{stats.mastered}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: D.textMid }}>
            <span style={{ width: 8, height: 8, borderRadius: 100, background: D.gold, flexShrink: 0 }} />
            Learning
          </div>
          <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: D.textHi }}>{stats.learning}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: D.textMid }}>
            <span style={{ width: 8, height: 8, borderRadius: 100, background: D.textLow, flexShrink: 0 }} />
            Not started
          </div>
          <span style={{ fontFamily: FONTS.mono, fontWeight: 600, color: D.textHi }}>{stats.notStarted}</span>
        </div>
      </div>
    </div>
  );
}
