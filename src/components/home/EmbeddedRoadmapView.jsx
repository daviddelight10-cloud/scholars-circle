import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  fetchSkeleton,
  fetchTopicProgress,
  fetchTopicMatches,
  generateSkeleton,
  reorderTopics,
  createTopic,
} from "../../lib/skeletonGenerator";
import { retroactiveMatch } from "../../lib/topicMatcher";
import { extractFileText } from "../../lib/extractFileText";
import { FONTS } from "../../lib/theme";
import {
  D, findStartHereTopic, progressPct,
  OnboardingStep, DocRow,
} from "./roadmapShared";
import TopicSheet from "./TopicSheet";

const FILE_TYPES = ["pdf", "docx", "pptx", "txt", "image", "doc", "note", "tutorial_question"];

const ROADMAP_CACHE_TTL = 30 * 60 * 1000; // 30 min — files use the same pattern
const roadmapCacheKey = (courseCode) => `sc_roadmap_${courseCode}`;

function readRoadmapCache(courseCode) {
  try {
    const raw = localStorage.getItem(roadmapCacheKey(courseCode));
    if (raw) {
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < ROADMAP_CACHE_TTL) return data;
    }
  } catch {}
  return null;
}

function writeRoadmapCache(courseCode, data) {
  try { localStorage.setItem(roadmapCacheKey(courseCode), JSON.stringify({ data, ts: Date.now() })); } catch {}
}

export default function EmbeddedRoadmapView({
  courseCode,
  folderId,
  folderResources,
  onOpenResource,
  onStartStudying,
  onPracticeFile,
  onSetCourseCode,
  codeEditable = true,
  mcqProgress,
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
  const [editMode, setEditMode] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [addTopicOpen, setAddTopicOpen] = useState(false);
  const [addTopicTitle, setAddTopicTitle] = useState("");
  const [addingTopic, setAddingTopic] = useState(false);
  const [toast, setToast] = useState(null);
  const [editingCode, setEditingCode] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [savingCode, setSavingCode] = useState(false);
  const fileInputRef = useRef(null);
  const listRef = useRef(null);
  const dragStateRef = useRef(null);

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!courseCode) { setLoading(false); return; }
    if (!silent) {
      // Render cached topics instantly — refresh in the background like files do
      const cached = readRoadmapCache(courseCode);
      if (cached) {
        setTopics(cached.topics || []);
        setProgress(cached.progress ?? null);
        setMatches(cached.matches || []);
      } else {
        setLoading(true);
      }
    }
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
        writeRoadmapCache(courseCode, { topics: t, progress: prog, matches: mtch });
      } else {
        setProgress(null);
        setMatches([]);
        writeRoadmapCache(courseCode, { topics: [], progress: null, matches: [] });
      }
    } catch (err) {
      if (!silent) setError(err.message);
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

  // Build a map of resourceId -> full resource object (practice sheet needs the full resource with variants)
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
      } else if (topics.length > 0) {
        setSelectedTopicId(topics[0].id);
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

  async function handleSaveCourseCode() {
    const code = codeInput.trim();
    if (!code || savingCode || !onSetCourseCode) return;
    setSavingCode(true);
    setError("");
    try {
      await onSetCourseCode(code);
      setEditingCode(false);
      setCodeInput("");
      showToast("Course code saved");
    } catch (err) {
      setError(err.message || "Failed to save course code");
    } finally {
      setSavingCode(false);
    }
  }

  function moveTopic(topicId, dir) {
    const idx = topics.findIndex((t) => t.id === topicId);
    const next = idx + dir;
    if (idx < 0 || next < 0 || next >= topics.length) return;
    const newTopics = [...topics];
    [newTopics[idx], newTopics[next]] = [newTopics[next], newTopics[idx]];
    const reordered = newTopics.map((t, i) => ({ ...t, displayOrder: i }));
    setTopics(reordered);
    reorderTopics(courseCode, reordered.map((t) => String(t.id))).catch((err) => {
      console.error("Reorder failed:", err);
      showToast("Failed to save order");
    });
    if (navigator.vibrate) navigator.vibrate(6);
  }

  async function handleAddTopic() {
    const title = addTopicTitle.trim();
    if (!title || addingTopic || !courseCode) return;
    setAddingTopic(true);
    setError("");
    try {
      const updated = await createTopic(courseCode, title, topics.length);
      setTopics(updated);
      setAddTopicTitle("");
      setAddTopicOpen(false);
      showToast("Topic added");
    } catch (err) {
      setError(err.message || "Failed to add topic");
    } finally {
      setAddingTopic(false);
    }
  }

  function handleDragStart(e, topicId) {
    if (!editMode) return;
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

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
    row.style.height = rect.height + 'px';
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
      if (tTopic) {
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

    const newTopics = newOrderIds.map((id, i) => {
      const t = topics.find(t => String(t.id) === id);
      return t ? { ...t, displayOrder: i } : null;
    }).filter(Boolean);

    ds.row.style.position = '';
    ds.row.style.left = '';
    ds.row.style.top = '';
    ds.row.style.width = '';
    ds.row.style.height = '';
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

  const codeEditor = codeEditable && (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        value={codeInput}
        onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
        onKeyDown={(e) => { if (e.key === "Enter") handleSaveCourseCode(); if (e.key === "Escape") setEditingCode(false); }}
        placeholder="e.g. MED301"
        autoFocus
        style={{
          background: "#0D1220", border: `0.5px solid ${D.gold}44`, borderRadius: 8,
          padding: "8px 12px", fontSize: 13, color: D.textHi, fontFamily: FONTS.body,
          width: 140, outline: "none", textTransform: "uppercase",
        }}
      />
      <button className="sp-roadmap-btn" onClick={handleSaveCourseCode} disabled={savingCode || !codeInput.trim()}>
        {savingCode ? "Saving…" : "Save"}
      </button>
      {courseCode && (
        <button className="sp-roadmap-btn" onClick={() => { setEditingCode(false); setCodeInput(""); }}>
          Cancel
        </button>
      )}
    </div>
  );

  // No course code yet — let the user name the course to unlock the roadmap
  if (!courseCode) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
        padding: "48px 20px", textAlign: "center",
      }}>
        <div style={{ fontSize: 34 }}>🗺️</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
          Name this course
        </div>
        <div style={{ fontSize: 12, color: D.textMid, fontFamily: FONTS.body, maxWidth: 340, lineHeight: 1.6 }}>
          Set a course code (like <b style={{ color: D.gold }}>MED301</b>) to build a topic roadmap and organize these documents.
        </div>
        {codeEditable ? codeEditor : (
          <div style={{ fontSize: 12, color: D.textLow, fontFamily: FONTS.body }}>
            The folder owner hasn't set a course code yet.
          </div>
        )}
        {error && (
          <div style={{ fontSize: 12, color: D.coral, fontFamily: FONTS.body }}>{error}</div>
        )}
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
        marginTop: 8, marginBottom: 12, gap: 10,
      }}>
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", fontFamily: "'Lora', Georgia, serif", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            Roadmap
            {courseCode && !editingCode && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: D.gold, fontFamily: FONTS.body,
                background: "rgba(245,166,35,0.12)", border: `0.5px solid ${D.gold}33`,
                borderRadius: 6, padding: "2px 8px", letterSpacing: "0.06em",
                display: "inline-flex", alignItems: "center", gap: 5,
              }}>
                {courseCode}
                {codeEditable && onSetCourseCode && (
                  <button
                    onClick={() => { setEditingCode(true); setCodeInput(courseCode); }}
                    title="Edit course code"
                    style={{ background: "none", border: "none", color: D.gold, cursor: "pointer", fontSize: 10, padding: 0, lineHeight: 1 }}
                  >✎</button>
                )}
              </span>
            )}
          </h3>
          {editingCode ? (
            <div style={{ marginTop: 8 }}>{codeEditor}</div>
          ) : (
            <p style={{ fontSize: 11, color: "#646E84", margin: "2px 0 0", fontFamily: "'Inter', sans-serif" }}>
              {topics.length} topics · {stats?.mastered || 0} mastered
            </p>
          )}
        </div>

        {topics.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              className={`sp-roadmap-btn${editMode ? " active" : ""}`}
              onClick={() => setEditMode(!editMode)}
            >
              {editMode ? "✓ Done" : "✎ Edit order"}
            </button>

            <button className="sp-roadmap-btn" onClick={handleRetroactiveMatch} disabled={!!matchProgress}>
              {matchProgress ? `${matchProgress.label}` : "🔗 Match Docs"}
            </button>
          </div>
        )}
      </div>

      {/* Edit hint */}
      {topics.length > 0 && (
        <div className={`cs-edit-hint${editMode ? " active" : ""}`}>
          {editMode
            ? "Drag the handle to reorder your topics."
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
        <div>
          {/* Start Here card */}
          {startHereTopic && (
            <button
              className="sp-start-card sp-fade-up"
              style={{ width: "100%", textAlign: "left", display: "block" }}
              onClick={() => { setSelectedTopicId(startHereTopic.id); setDetailOpen(true); }}
            >
              <div style={{ position: "absolute", top: -16, right: -16, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,166,35,0.2), transparent 70%)", pointerEvents: "none" }} />
              <div style={{ position: "relative" }}>
                <span className="sp-start-chip">START HERE</span>
                <h4 style={{ color: "#fff", fontSize: 16, fontWeight: 700, marginTop: 8, marginBottom: 0, fontFamily: "'Lora', Georgia, serif" }}>
                  {startHereTopic.title}
                </h4>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontSize: 10, color: "#9AA3B5", fontFamily: "'Inter', sans-serif" }}>
                  <span>📄 {(matchesByTopic.get(startHereTopic.id) || []).length} docs</span>
                  <span style={{ color: "#3DD68C" }}>● {progress?.[startHereTopic.id]?.label || "New"}</span>
                </div>
              </div>
            </button>
          )}

          {/* Topic spine — nodes connected by a continuous vertical line */}
          <div
            ref={listRef}
            className={`sp-topic-spine${editMode ? " editing" : ""}`}
            style={{ marginTop: 12 }}
          >
            {topics.map((topic, idx) => {
              const p = progress?.[topic.id];
              const pct = progressPct(p);
              const label = p?.label || "Not started";
              const docCount = (matchesByTopic.get(topic.id) || []).length;
              const ringColor = label === "Mastered" ? "#3DD68C" : pct > 0 ? "#F5A623" : "#646E84";
              const badgeStyle = label === "Mastered"
                ? { background: "rgba(61,214,140,0.12)", color: "#3DD68C", borderColor: "rgba(61,214,140,0.2)" }
                : pct > 0
                  ? { background: "rgba(245,166,35,0.12)", color: "#F5A623", borderColor: "rgba(245,166,35,0.2)" }
                  : { background: "rgba(255,255,255,0.03)", color: "#646E84", borderColor: "rgba(255,255,255,0.07)" };
              const isLast = idx === topics.length - 1;
              const C = 2 * Math.PI * 16; // r=16 ring
              return (
                <div
                  key={topic.id}
                  data-topic-id={topic.id}
                  className={`sp-spine-row sp-fade-up${selectedTopicId === topic.id ? " selected" : ""}`}
                  style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}
                  onClick={() => { if (!editMode) { setSelectedTopicId(topic.id); setDetailOpen(true); } }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (!editMode && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setSelectedTopicId(topic.id); setDetailOpen(true); } }}
                >
                  {editMode && (
                    <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                      <button
                        aria-label={`Move ${topic.title} up`}
                        disabled={idx === 0}
                        onClick={(e) => { e.stopPropagation(); moveTopic(topic.id, -1); }}
                        style={{
                          background: "transparent", border: "none", color: idx === 0 ? "#3a4150" : "#9AA3B5",
                          cursor: idx === 0 ? "default" : "pointer", fontSize: 13, padding: "4px 2px",
                        }}
                      >
                        ▲
                      </button>
                      <button
                        aria-label={`Drag to reorder ${topic.title}`}
                        onPointerDown={(e) => handleDragStart(e, topic.id)}
                        style={{
                          background: "transparent", border: "none", color: "#646E84",
                          cursor: "grab", fontSize: 15, padding: "4px 2px",
                          touchAction: "none",
                        }}
                      >
                        ⠿
                      </button>
                      <button
                        aria-label={`Move ${topic.title} down`}
                        disabled={isLast}
                        onClick={(e) => { e.stopPropagation(); moveTopic(topic.id, 1); }}
                        style={{
                          background: "transparent", border: "none", color: isLast ? "#3a4150" : "#9AA3B5",
                          cursor: isLast ? "default" : "pointer", fontSize: 13, padding: "4px 2px",
                        }}
                      >
                        ▼
                      </button>
                    </div>
                  )}
                  {/* Ring node on the spine — connector drops from its bottom to the next node */}
                  <div className="sp-spine-node">
                    <svg width="40" height="40" viewBox="0 0 40 40" style={{ display: "block", background: "transparent" }}>
                      <circle cx="20" cy="20" r="16" fill="#10141C" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                      <circle cx="20" cy="20" r="16" fill="none" stroke={ringColor} strokeWidth="3" strokeLinecap="round"
                        strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - pct / 100)).toFixed(1)}
                        transform="rotate(-90 20 20)" />
                    </svg>
                    <div style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, color: pct > 0 ? ringColor : "#646E84",
                    }}>
                      {pct}%
                    </div>
                    {!isLast && !editMode && <div className="sp-spine-line" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: "#EDEFF5", margin: 0, fontFamily: "'Inter', sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {topic.title}
                    </h3>
                    <p style={{ fontSize: 10, margin: "2px 0 0", fontFamily: "'Inter', sans-serif", color: pct > 0 ? ringColor : "#646E84" }}>
                      {label} · {docCount} doc{docCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className="sp-topic-badge" style={badgeStyle}>{label}</span>
                </div>
              );
            })}
          </div>

          {/* Add-topic inline form */}
          {addTopicOpen && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="text"
                value={addTopicTitle}
                onChange={(e) => setAddTopicTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddTopic(); if (e.key === "Escape") setAddTopicOpen(false); }}
                placeholder="Topic title…"
                autoFocus
                className="sp-search"
                style={{ borderRadius: 12, fontSize: 13 }}
              />
              <button
                onClick={handleAddTopic}
                disabled={addingTopic || !addTopicTitle.trim()}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2.5 text-[11px] font-bold text-black transition-all active:scale-95"
                style={{ background: "#F5A623", border: "none", opacity: addingTopic || !addTopicTitle.trim() ? 0.5 : 1 }}
              >
                {addingTopic ? "Adding…" : "Add"}
              </button>
              <button
                onClick={() => { setAddTopicOpen(false); setAddTopicTitle(""); }}
                className="sp-roadmap-btn"
                style={{ padding: "8px 12px" }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <button
              onClick={() => setAddTopicOpen(true)}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 12,
                border: "1px dashed rgba(255,255,255,0.15)", background: "transparent",
                color: "#646E84", fontSize: 12, fontWeight: 600, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "'Inter', sans-serif", transition: "all 0.2s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#F5A623"; e.currentTarget.style.color = "#F5A623"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#646E84"; }}
            >
              + Add Topic
            </button>
            <button
              onClick={() => setShowRegenPrompt(true)}
              disabled={generating || uploading}
              style={{
                width: "100%", padding: "12px 0", borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.07)", background: "#151A24",
                color: "#EDEFF5", fontSize: 12, fontWeight: 600, cursor: generating ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "'Inter', sans-serif", transition: "background 0.2s",
                opacity: generating || uploading ? 0.5 : 1,
              }}
            >
              <span style={{ color: "#F5A623" }}>↻</span> {generating ? "Regenerating…" : "Regenerate Topics"}
            </button>
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
                  <DocRow
                    key={file.id}
                    match={{ resource: file }}
                    variants={file.variants}
                    onTap={() => (onPracticeFile ? onPracticeFile(file) : file.shareToken && onOpenResource?.(file.shareToken))}
                  />
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
      )}

      {/* Topic detail sheet */}
      {detailOpen && selectedTopic && (
        <TopicSheet
          key={selectedTopic.id}
          topic={selectedTopic}
          topics={topics}
          progress={progress?.[selectedTopic.id]}
          matches={matchesByTopic.get(selectedTopic.id) || []}
          isStartHere={startHereTopic?.id === selectedTopic.id}
          resourceVariantsMap={resourceVariantsMap}
          mcqProgress={mcqProgress}
          onOpenResource={onOpenResource}
          onStartStudying={handleStartStudying}
          onPracticeDoc={(m) => {
            const full = resourceByIdMap.get(m.resourceId) || m.resource;
            if (full) onPracticeFile?.(full);
          }}
          onClose={() => setDetailOpen(false)}
        />
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
