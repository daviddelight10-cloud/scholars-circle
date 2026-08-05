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
import { API_BASE } from "../../lib/constants";
import { PRESET_SUBJECTS } from "../../features/research-hub/constants";
import { FONTS } from "../../lib/theme";
import {
  D, isTopicLocked, findStartHereTopic,
  StatItem, TopicDetailPanel, OnboardingStep, TimelineTopicRow,
} from "./roadmapShared";

const PRESET_SET = new Set(PRESET_SUBJECTS.filter((s) => s !== "Custom"));

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

export default function TopicSkeletonView({ courseCode: initialCourseCode, onExit, onOpenResource, onStartStudying, authUser }) {
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
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [showDetailMobile, setShowDetailMobile] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [courseGroups, setCourseGroups] = useState({ preset: [], user: [], folder: [] });
  const [showRegenPrompt, setShowRegenPrompt] = useState(false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Build course list from folders + live resource subjects
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
      // From preset subjects (same list as Upload Wizard — always available)
      const presetCourses = [];
      for (const s of PRESET_SUBJECTS) {
        if (s === "Custom") continue;
        if (!courseSet.has(s)) {
          courseSet.add(s);
          presetCourses.push(s);
        }
      }

      // From live resource subjects (not stale localStorage cache)
      const userCourses = [];
      try {
        const res = await authFetch(`${API_BASE}/api/resources`);
        if (res.ok) {
          const resources = await res.json();
          const currentUserId = authUser?.id ? String(authUser.id) : null;
          for (const r of resources) {
            if (!r.subject || courseSet.has(r.subject)) continue;
            const isPreset = PRESET_SET.has(r.subject);
            const isOwn = r.uploadedBy && currentUserId && String(r.uploadedBy) === currentUserId;
            if (isPreset || isOwn) {
              courseSet.add(r.subject);
              userCourses.push(r.subject);
            }
          }
          try { localStorage.setItem("sc_resources_list", JSON.stringify({ data: resources, ts: Date.now() })); } catch {}
        }
      } catch {}
      const folderCourses = courseList.filter((c) => !presetCourses.includes(c) && !userCourses.includes(c));
      setCourses([...presetCourses, ...userCourses, ...folderCourses]);
      setCourseGroups({ preset: presetCourses, user: userCourses, folder: folderCourses });
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

  // Auto-select first topic (or start-here topic) when topics load
  useEffect(() => {
    if (topics.length > 0 && !selectedTopicId) {
      const start = findStartHereTopic(topics, progress, matchesByTopic);
      if (start) {
        setSelectedTopicId(start.id);
      } else {
        const firstAccessible = topics.find((t) => {
          const isLocked = isTopicLocked(t, topics, progress);
          const hasDocs = matchesByTopic.has(t.id);
          return !isLocked || hasDocs;
        });
        if (firstAccessible) setSelectedTopicId(firstAccessible.id);
      }
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
    setMatchProgress({ current: 0, total: 0, label: "Matching documents…" });
    setError("");
    try {
      const result = await retroactiveMatch(selectedCourse, (idx, total, name) => {
        setMatchProgress({ current: idx, total, label: name });
      });
      setMatchProgress({ current: result.resourceCount, total: result.resourceCount, label: `Done — ${result.matchCount} matches${result.errorCount ? ` (${result.errorCount} failed)` : ""}` });
      // Reload matches
      const mtch = await fetchTopicMatches(selectedCourse);
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
        display: "flex", alignItems: "center", gap: isMobile ? 8 : 12,
        padding: isMobile ? "10px 12px" : "14px 20px",
        borderBottom: `0.5px solid ${D.border}`,
        background: "rgba(10,12,18,0.95)", backdropFilter: "blur(10px)",
        flexShrink: 0, flexWrap: isMobile ? "wrap" : "nowrap",
      }}>
        <button onClick={onExit} style={{
          background: "none", border: "none", color: D.textMid, fontSize: 20, cursor: "pointer", padding: "4px 8px",
        }}>←</button>
        <div style={{ flex: 1, minWidth: isMobile ? 100 : undefined }}>
          <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
            Course Roadmap
          </div>
          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
            {selectedCourse || "Select a course"} · {topics.length} topics
          </div>
        </div>

        {/* Course selector */}
        {!manualEntry && courses.length > 0 ? (
          <div style={{ position: "relative", width: isMobile ? "100%" : 220 }}>
            <select
              value={courses.includes(selectedCourse) ? selectedCourse : ""}
              onChange={(e) => {
                if (e.target.value === "__custom__") { setManualEntry(true); setSelectedCourse(""); }
                else setSelectedCourse(e.target.value);
              }}
              style={{
                width: "100%", boxSizing: "border-box",
                background: `linear-gradient(180deg, ${D.panel}, ${D.ink})`,
                border: `0.5px solid ${D.border}`, borderRadius: 10,
                padding: "10px 36px 10px 14px", fontSize: 13, color: D.textHi,
                fontFamily: FONTS.body, outline: "none", cursor: "pointer",
                appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
              onFocus={(e) => { e.target.style.borderColor = D.gold + "66"; e.target.style.boxShadow = `0 0 0 3px ${D.gold}1A`; }}
              onBlur={(e) => { e.target.style.borderColor = D.border; e.target.style.boxShadow = "none"; }}
            >
              <option value="" disabled style={{ background: D.ink, color: D.textMid }}>Select a course…</option>
              {courseGroups.preset.length > 0 && (
                <optgroup label="Subjects" style={{ background: D.ink, color: D.gold }}>
                  {courseGroups.preset.map((c) => <option key={c} value={c} style={{ background: D.ink, color: D.textHi }}>{c}</option>)}
                </optgroup>
              )}
              {courseGroups.user.length > 0 && (
                <optgroup label="My Uploads" style={{ background: D.ink, color: D.blue }}>
                  {courseGroups.user.map((c) => <option key={c} value={c} style={{ background: D.ink, color: D.textHi }}>{c}</option>)}
                </optgroup>
              )}
              {courseGroups.folder.length > 0 && (
                <optgroup label="My Folders" style={{ background: D.ink, color: D.green }}>
                  {courseGroups.folder.map((c) => <option key={c} value={c} style={{ background: D.ink, color: D.textHi }}>{c}</option>)}
                </optgroup>
              )}
              <option value="__custom__" style={{ background: D.ink, color: D.textMid }}>+ Type a different course…</option>
            </select>
            <span style={{
              position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
              pointerEvents: "none", fontSize: 10, color: D.textMid,
            }}>▼</span>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, width: isMobile ? "100%" : "auto" }}>
            <input
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              placeholder="Course code…"
              autoFocus={manualEntry}
              style={{
                background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 8,
                padding: "8px 14px", fontSize: 12, color: D.textHi, fontFamily: FONTS.body,
                outline: "none", flex: 1, minWidth: 0, boxSizing: "border-box",
              }}
            />
            {courses.length > 0 && (
              <button onClick={() => setManualEntry(false)} style={{
                background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 8,
                padding: "8px 10px", fontSize: 11, color: D.textMid, cursor: "pointer",
                fontFamily: FONTS.body, whiteSpace: "nowrap",
              }}>
                List
              </button>
            )}
          </div>
        )}

        {topics.length > 0 && (
          <button onClick={handleRetroactiveMatch} disabled={!!matchProgress} style={{
            background: D.panel, border: `0.5px solid ${D.blue}`, borderRadius: 8,
            padding: isMobile ? "6px 10px" : "8px 14px", fontSize: isMobile ? 10 : 11, color: D.blue, cursor: matchProgress ? "not-allowed" : "pointer",
            fontFamily: FONTS.body, fontWeight: 600, whiteSpace: "nowrap",
          }}>
            {matchProgress ? `${matchProgress.label}` : isMobile ? "🔗" : "🔗 Match Docs"}
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

        <button onClick={() => topics.length > 0 ? setShowRegenPrompt(true) : fileInputRef.current?.click()} disabled={generating || uploading || !selectedCourse.trim()} style={{
          background: generating ? "rgba(245,166,35,0.15)" : "linear-gradient(135deg, #b8860b, #F5A623)",
          border: "none", borderRadius: 8, padding: isMobile ? "6px 12px" : "8px 16px",
          fontSize: isMobile ? 11 : 12, fontWeight: 600, color: generating ? D.gold : "#0a0a0a",
          cursor: (generating || uploading) ? "not-allowed" : "pointer", fontFamily: FONTS.body, whiteSpace: "nowrap",
        }}>
          {generating ? "…" : topics.length > 0 ? (isMobile ? "Rebuild" : "Regenerate") : "Build Roadmap"}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div style={{ padding: "8px 20px", background: "rgba(255,84,112,0.1)", borderBottom: `0.5px solid ${D.coral}33`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
        <div style={{ padding: "8px 20px", background: "rgba(245,166,35,0.08)", borderBottom: `0.5px solid ${D.gold}22` }}>
          <span style={{ fontSize: 12, color: D.gold, fontFamily: FONTS.body }}>
            {genProgress || (matchProgress ? `${matchProgress.label} (${matchProgress.current}/${matchProgress.total})` : "")}
          </span>
        </div>
      )}

      {/* Regenerate prompt — ask user to upload outline */}
      {showRegenPrompt && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100, background: "rgba(7,9,13,0.7)",
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
                cursor: "pointer", fontFamily: FONTS.body, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                📎 Upload Course Outline
              </button>
              <button onClick={() => { setShowRegenPrompt(false); handleGenerate(); }} style={{
                background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 10,
                padding: "12px 20px", fontSize: 13, fontWeight: 500, color: D.textMid,
                cursor: "pointer", fontFamily: FONTS.body, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
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

      {/* Body — two-column layout: path/timeline + sticky detail panel */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: isMobile ? "column" : "row" }}>
        {loading ? (
          <div style={{ flex: 1, textAlign: "center", padding: "60px 0", color: D.textMid, fontSize: 14, fontFamily: FONTS.body }}>
            Loading skeleton…
          </div>
        ) : topics.length === 0 ? (
          /* B2: Guided empty state onboarding */
          <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "24px 12px" : "40px 20px", display: "flex", flexDirection: "column", alignItems: "center" }}>
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
              flex: isMobile ? (showDetailMobile ? "0 0 auto" : "1 1 auto") : "1 1 45%",
              overflowY: "auto", padding: isMobile ? "12px 10px" : "16px 12px 16px 20px",
              borderRight: isMobile ? "none" : `0.5px solid ${D.border}`,
              borderBottom: isMobile ? `0.5px solid ${D.border}` : "none",
              display: isMobile && showDetailMobile ? "none" : "block",
              maxHeight: isMobile ? "100%" : undefined,
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
                  />
                ))}
              </div>
            </div>

            {/* Right column — Sticky detail panel */}
            <div style={{
              flex: isMobile ? "1 1 auto" : "1 1 55%", overflowY: "auto",
              padding: isMobile ? "12px 10px" : "20px",
              display: isMobile && !showDetailMobile ? "none" : "block",
            }}>
              {/* Mobile back-to-list button */}
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
