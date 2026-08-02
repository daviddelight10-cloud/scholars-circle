import { useState, useEffect, useMemo } from "react";
import { fetchSkeleton, fetchTopicProgress } from "../../lib/skeletonGenerator";
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

export default function TopicSkeletonCard({ onOpenSkeleton, token }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState("");
  const [skeleton, setSkeleton] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Build course list from folders + resource subjects
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

      // From resource subjects (cached in localStorage)
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

  // Fetch skeleton when a course is selected
  useEffect(() => {
    if (!selectedCourse) {
      setSkeleton(null);
      setProgress(null);
      return;
    }
    setLoading(true);
    async function load() {
      try {
        const topics = await fetchSkeleton(selectedCourse);
        setSkeleton(topics);
        if (topics.length > 0) {
          const prog = await fetchTopicProgress(selectedCourse);
          setProgress(prog);
        } else {
          setProgress(null);
        }
      } catch (err) {
        setSkeleton(null);
        setProgress(null);
      } finally {
        setLoading(false);
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

  return (
    <div style={{
      background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
      border: `0.5px solid ${D.border}`,
      borderRadius: 16,
      padding: "16px 18px",
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
          📋
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
            Topic Skeleton
          </div>
          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
            {skeleton ? `${skeleton.length} topics` : "Build a learning roadmap"}
          </div>
        </div>
      </div>

      {/* Course selector */}
      <div style={{ position: "relative", marginBottom: 10 }} onClick={(e) => e.stopPropagation()}>
        <input
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
          placeholder="Select or type a course…"
          list="skeletonCourseOptions"
          style={{
            width: "100%", boxSizing: "border-box",
            background: D.ink, border: `0.5px solid ${D.border}`,
            borderRadius: 8, padding: "8px 12px",
            fontSize: 12, color: D.textHi, fontFamily: FONTS.body,
            outline: "none",
          }}
        />
        <datalist id="skeletonCourseOptions">
          {courses.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ fontSize: 11, color: D.textMid, textAlign: "center", padding: "12px 0" }}>
          Loading skeleton…
        </div>
      ) : stats ? (
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
        <div style={{ fontSize: 11, color: D.textMid, textAlign: "center", padding: "8px 0", fontFamily: FONTS.body, lineHeight: 1.5 }}>
          {selectedCourse
            ? "No skeleton yet — click to build one with AI"
            : "Select a course to view or build your topic roadmap"}
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
