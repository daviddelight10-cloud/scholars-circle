import { useState, useEffect, useMemo, useRef } from "react";
import { fetchSkeleton, fetchTopicProgress, fetchTopicMatches, generateSkeleton } from "../../lib/skeletonGenerator";
import { listFolders } from "../../lib/foldersApi";
import { extractFileText } from "../../lib/extractFileText";
import { API_BASE } from "../../lib/constants";
import { PRESET_SUBJECTS } from "../../features/research-hub/constants";
import { FONTS } from "../../lib/theme";

const PRESET_SET = new Set(PRESET_SUBJECTS.filter((s) => s !== "Custom"));

async function authFetch(url, opts = {}) {
  let token = null;
  try { token = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken; } catch {}
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { ...opts, headers, credentials: "include" });
}

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

export default function TopicSkeletonCard({ onOpenSkeleton, token, authUser }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [skeleton, setSkeleton] = useState(null);
  const [progress, setProgress] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState("");
  const [matches, setMatches] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [manualEntry, setManualEntry] = useState(false);
  const [courseGroups, setCourseGroups] = useState({ preset: [], user: [], folder: [] });

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Build course list from folders + live resource subjects, auto-select first course
  useEffect(() => {
    async function loadCourses() {
      const courseSet = new Set();
      const courseList = [];

      // From folders
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
            // Preset subjects: show to everyone. Custom subjects: only to the user who added them.
            const isPreset = PRESET_SET.has(r.subject);
            const isOwn = r.uploadedBy && currentUserId && String(r.uploadedBy) === currentUserId;
            if (isPreset || isOwn) {
              courseSet.add(r.subject);
              userCourses.push(r.subject);
            }
          }
          // Update cache for other consumers
          try { localStorage.setItem("sc_resources_list", JSON.stringify({ data: resources, ts: Date.now() })); } catch {}
        }
      } catch {}

      // Presets first, then user-specific courses, then folder codes (already in courseList)
      const folderCourses = courseList.filter((c) => !presetCourses.includes(c) && !userCourses.includes(c));
      setCourses([...presetCourses, ...userCourses, ...folderCourses]);
      setCourseGroups({ preset: presetCourses, user: userCourses, folder: folderCourses });
      // Auto-select first available course
      if (courseList.length > 0 && !selectedCourse) {
        setSelectedCourse(courseList[0]);
      }
    }
    loadCourses();
  }, []);

  // Fetch skeleton when a course is selected
  useEffect(() => {
    if (!selectedCourse) {
      setSkeleton(null);
      setProgress(null);
      return;
    }
    async function load() {
      try {
        const topics = await fetchSkeleton(selectedCourse);
        setSkeleton(topics);
        if (topics.length > 0) {
          const [prog, mtch] = await Promise.all([
            fetchTopicProgress(selectedCourse),
            fetchTopicMatches(selectedCourse),
          ]);
          setProgress(prog);
          setMatches(mtch);
        } else {
          setProgress(null);
          setMatches([]);
        }
      } catch (err) {
        setSkeleton(null);
        setProgress(null);
        setMatches([]);
      }
    }
    load();
  }, [selectedCourse]);

  const stats = useMemo(() => {
    if (!skeleton || skeleton.length === 0) return null;
    if (!progress) return { total: skeleton.length, mastered: 0, learning: 0, notStarted: skeleton.length };
    let mastered = 0, learning = 0, notStarted = 0;
    for (const t of skeleton) {
      const p = progress[t.id];
      if (!p || p.label === "Not started") notStarted++;
      else if (p.label === "Mastered") mastered++;
      else learning++;
    }
    return { total: skeleton.length, mastered, learning, notStarted };
  }, [skeleton, progress]);

  const masteredPct = stats ? Math.round((stats.mastered / stats.total) * 100) : 0;
  const docCount = useMemo(() => new Set(matches.map((m) => m.resourceId)).size, [matches]);

  // Find the topic to continue with — first in-progress, or first not-started
  const continueTopic = useMemo(() => {
    if (!skeleton || skeleton.length === 0) return null;
    // First pass: find a topic that's in progress (Learning/Reviewing/New)
    for (const t of skeleton) {
      const p = progress?.[t.id];
      if (p && (p.label === "Learning" || p.label === "Reviewing" || p.label === "New")) return t;
    }
    // Second pass: first not-started
    for (const t of skeleton) {
      const p = progress?.[t.id];
      if (!p || p.label === "Not started") return t;
    }
    return null;
  }, [skeleton, progress]);

  // Card state: "empty" | "processing" | "ready"
  const cardState = (generating || uploading) ? "processing" : (skeleton && skeleton.length > 0) ? "ready" : "empty";

  async function handleQuickGenerate(e) {
    e.stopPropagation();
    if (!selectedCourse.trim() || generating) return;
    setGenerating(true);
    setGenProgress("Generating roadmap…");
    try {
      const result = await generateSkeleton({
        courseName: selectedCourse,
        onProgress: setGenProgress,
      });
      setSkeleton(result.topics);
      setGenProgress("");
      // Fetch progress and matches for the new skeleton
      const [prog, mtch] = await Promise.all([
        fetchTopicProgress(selectedCourse),
        fetchTopicMatches(selectedCourse),
      ]);
      setProgress(prog);
      setMatches(mtch);
    } catch (err) {
      setGenProgress("");
    } finally {
      setGenerating(false);
    }
  }

  async function handleOutlineUpload(e) {
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file || !selectedCourse.trim() || generating) return;
    setUploading(true);
    setGenProgress("Extracting outline text…");
    try {
      const { text } = await extractFileText(file);
      if (!text || text.trim().length < 50) {
        setGenProgress("");
        setUploading(false);
        return;
      }
      setGenerating(true);
      setGenProgress("Generating roadmap from syllabus…");
      const result = await generateSkeleton({
        courseName: selectedCourse,
        outlineText: text,
        onProgress: setGenProgress,
      });
      setSkeleton(result.topics);
      setGenProgress("");
      const [prog, mtch] = await Promise.all([
        fetchTopicProgress(selectedCourse),
        fetchTopicMatches(selectedCourse),
      ]);
      setProgress(prog);
      setMatches(mtch);
    } catch (err) {
      setGenProgress("");
    } finally {
      setUploading(false);
      setGenerating(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div style={{
      background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
      border: `0.5px solid ${D.border}`,
      borderRadius: 16,
      padding: isMobile ? "12px 14px" : "16px 18px",
      cursor: "pointer",
      transition: "border-color 0.2s, transform 0.15s",
    }}
    onClick={() => onOpenSkeleton?.(selectedCourse)}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = D.gold + "44"; e.currentTarget.style.transform = "translateY(-2px)"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(245,166,35,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18,
        }}>
          �️
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
            Course Roadmap
          </div>
          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
            {cardState === "ready" ? `${skeleton.length} topics · ${docCount} docs · ${masteredPct}% mastered` : cardState === "processing" ? "Building your roadmap…" : "Build a learning roadmap"}
          </div>
        </div>
      </div>

      {/* Course selector */}
      <div style={{ position: "relative", marginBottom: 10 }} onClick={(e) => e.stopPropagation()}>
        {!manualEntry && courses.length > 0 ? (
          <div style={{ position: "relative", width: "100%" }}>
            <select
              value={courses.includes(selectedCourse) ? selectedCourse : ""}
              onChange={(e) => {
                if (e.target.value === "__custom__") { setManualEntry(true); setSelectedCourse(""); }
                else setSelectedCourse(e.target.value);
              }}
              style={{
                width: "100%", boxSizing: "border-box",
                background: `linear-gradient(180deg, ${D.panel}, ${D.ink})`,
                border: `0.5px solid ${D.border}`,
                borderRadius: 10, padding: "10px 36px 10px 14px",
                fontSize: 13, color: D.textHi, fontFamily: FONTS.body,
                outline: "none", cursor: "pointer",
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
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={selectedCourse}
              onChange={(e) => setSelectedCourse(e.target.value)}
              placeholder="Type a course code…"
              autoFocus={manualEntry}
              style={{
                flex: 1, boxSizing: "border-box",
                background: D.ink, border: `0.5px solid ${D.border}`,
                borderRadius: 8, padding: "8px 12px",
                fontSize: 12, color: D.textHi, fontFamily: FONTS.body,
                outline: "none",
              }}
            />
            {courses.length > 0 && (
              <button onClick={() => setManualEntry(false)} style={{
                background: D.panel, border: `0.5px solid ${D.border}`, borderRadius: 8,
                padding: "8px 10px", fontSize: 11, color: D.textMid, cursor: "pointer", fontFamily: FONTS.body,
                whiteSpace: "nowrap",
              }}>
                List
              </button>
            )}
          </div>
        )}
      </div>

      {/* Content — three-state card */}
      {cardState === "processing" ? (
        /* Processing state */
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 8, animation: "spin 1s linear infinite", display: "inline-block" }}>⚙️</div>
          <div style={{ fontSize: 12, color: D.gold, fontFamily: FONTS.body, marginBottom: 4 }}>
            {genProgress || "Generating roadmap…"}
          </div>
          <div style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.body }}>
            This may take a few seconds
          </div>
        </div>
      ) : cardState === "ready" ? (
        /* Ready state */
        <>
          {/* Progress bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: D.textMid, fontFamily: FONTS.body }}>Mastery Progress</span>
              <span style={{ fontSize: 10, color: D.gold, fontWeight: 600, fontFamily: FONTS.body }}>{masteredPct}%</span>
            </div>
            <div style={{ height: 5, background: D.ink, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${masteredPct}%`, background: `linear-gradient(90deg, ${D.gold}, ${D.green})`, borderRadius: 3, transition: "width 0.3s" }} />
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 8 }}>
            <StatPill label="Mastered" value={stats.mastered} color={D.green} />
            <StatPill label="Learning" value={stats.learning} color={D.gold} />
            <StatPill label="Not started" value={stats.notStarted} color={D.textLow} />
          </div>

          {/* Continue where you left off */}
          {continueTopic && (
            <div onClick={(e) => { e.stopPropagation(); onOpenSkeleton?.(selectedCourse); }} style={{
              display: "flex", alignItems: "center", gap: 8, marginTop: 10,
              padding: "10px 12px", background: "rgba(245,166,35,0.08)",
              border: `0.5px solid ${D.gold}33`, borderRadius: 8, cursor: "pointer",
            }}>
              <span style={{ fontSize: 14 }}>{progress?.[continueTopic.id]?.label === "Not started" || !progress?.[continueTopic.id] ? "▶" : "↻"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 9, color: D.gold, fontFamily: FONTS.mono, textTransform: "uppercase", letterSpacing: "0.06em", fontWeight: 600 }}>
                  {progress?.[continueTopic.id]?.label === "Not started" || !progress?.[continueTopic.id] ? "Start Here" : "Continue"}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: D.textHi, fontFamily: FONTS.body, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {continueTopic.title}
                </div>
              </div>
              <span style={{ color: D.gold, fontSize: 12 }}>→</span>
            </div>
          )}

          {/* Topic preview (first 3) */}
          {skeleton && skeleton.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              {skeleton.slice(0, 3).map((t, i) => {
                const p = progress?.[t.id];
                const color = p ? PROGRESS_COLORS[p.label] || D.textMid : D.textLow;
                return (
                  <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: FONTS.body }}>
                    <span style={{ color: D.textLow, width: 16 }}>{i + 1}.</span>
                    <span style={{ color: D.textMid, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  </div>
                );
              })}
              {skeleton.length > 3 && (
                <div style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.body, paddingLeft: 22 }}>
                  +{skeleton.length - 3} more…
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Empty state */
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body, lineHeight: 1.5, marginBottom: 10 }}>
            {selectedCourse
              ? "No roadmap yet — build one with AI"
              : "Select a course to build your topic roadmap"}
          </div>
          {selectedCourse && (
            <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={handleQuickGenerate} disabled={generating || uploading} style={{
                background: "linear-gradient(135deg, #b8860b, #F5A623)",
                border: "none", borderRadius: 8, padding: "8px 18px",
                fontSize: 12, fontWeight: 600, color: "#0a0a0a",
                cursor: "pointer", fontFamily: FONTS.body,
              }}>
                Build Roadmap
              </button>
              <span style={{ fontSize: 10, color: D.textLow, fontFamily: FONTS.body }}>or</span>
              <button onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} disabled={generating || uploading} style={{
                background: "none", border: `0.5px solid ${D.border}`, borderRadius: 8, padding: "8px 14px",
                fontSize: 12, fontWeight: 600, color: D.blue, cursor: "pointer", fontFamily: FONTS.body,
                display: "flex", alignItems: "center", gap: 6,
              }}>
                📎 Upload Syllabus
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                style={{ display: "none" }}
                onChange={handleOutlineUpload}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
      background: D.ink, borderRadius: 6, padding: "6px 4px",
    }}>
      <span style={{ fontSize: 14, fontWeight: 700, color, fontFamily: FONTS.display }}>{value}</span>
      <span style={{ fontSize: 9, color: D.textMid, fontFamily: FONTS.body }}>{label}</span>
    </div>
  );
}
