import { useState, useEffect, useMemo } from "react";
import { fetchSkeleton, fetchTopicProgress, fetchTopicMatches } from "../../lib/skeletonGenerator";
import { listFolders } from "../../lib/foldersApi";
import { FONTS } from "../../lib/theme";
import { D, PROGRESS_COLORS } from "./roadmapShared";

export default function TopicSkeletonCard({ onOpenSkeleton, token, authUser }) {
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [skeleton, setSkeleton] = useState(null);
  const [progress, setProgress] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" ? window.innerWidth < 768 : false);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Load folders
  useEffect(() => {
    async function loadFolders() {
      setLoading(true);
      try {
        const result = await listFolders();
        const all = [...(result.own || []), ...(result.shared || []), ...(result.link || [])];
        // Only folders with a courseCode are relevant for roadmaps
        const withCourse = all.filter((f) => f.courseCode);
        setFolders(withCourse);
        if (withCourse.length > 0 && !selectedFolderId) {
          setSelectedFolderId(withCourse[0].id);
        }
      } catch {
        setFolders([]);
      } finally {
        setLoading(false);
      }
    }
    loadFolders();
  }, []);

  const selectedFolder = useMemo(() => folders.find((f) => f.id === selectedFolderId) || null, [folders, selectedFolderId]);

  // Fetch skeleton + progress when folder changes
  useEffect(() => {
    if (!selectedFolder?.courseCode) {
      setSkeleton(null);
      setProgress(null);
      setMatches([]);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const topics = await fetchSkeleton(selectedFolder.courseCode);
        if (cancelled) return;
        setSkeleton(topics);
        if (topics.length > 0) {
          const [prog, mtch] = await Promise.all([
            fetchTopicProgress(selectedFolder.courseCode),
            fetchTopicMatches(selectedFolder.courseCode),
          ]);
          if (cancelled) return;
          setProgress(prog);
          setMatches(mtch);
        } else {
          setProgress(null);
          setMatches([]);
        }
      } catch {
        if (!cancelled) { setSkeleton(null); setProgress(null); setMatches([]); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [selectedFolder?.courseCode]);

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

  const continueTopic = useMemo(() => {
    if (!skeleton || skeleton.length === 0) return null;
    for (const t of skeleton) {
      const p = progress?.[t.id];
      if (p && (p.label === "Learning" || p.label === "Reviewing" || p.label === "New")) return t;
    }
    for (const t of skeleton) {
      const p = progress?.[t.id];
      if (!p || p.label === "Not started") return t;
    }
    return null;
  }, [skeleton, progress]);

  const hasRoadmap = skeleton && skeleton.length > 0;

  function openFolderInHub() {
    if (!selectedFolder) return;
    window.dispatchEvent(new CustomEvent("sc-open-research-hub", {
      detail: { tab: "space", folderId: selectedFolder.id },
    }));
  }

  if (loading) {
    return (
      <div style={{
        background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
        border: `0.5px solid ${D.border}`, borderRadius: 16,
        padding: isMobile ? "12px 14px" : "16px 18px",
      }}>
        <div style={{ fontSize: 12, color: D.textMid, fontFamily: FONTS.body, textAlign: "center", padding: "20px 0" }}>
          Loading folders…
        </div>
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div style={{
        background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
        border: `0.5px solid ${D.border}`, borderRadius: 16,
        padding: isMobile ? "12px 14px" : "16px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, background: "rgba(245,166,35,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}>🗺️</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>Course Roadmap</div>
            <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>No folders with course codes yet</div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body, textAlign: "center", padding: "12px 0", lineHeight: 1.5 }}>
          Create a folder with a course code in My Circle to get a personalized learning roadmap.
        </div>
        <button onClick={() => window.dispatchEvent(new CustomEvent("sc-open-research-hub", { detail: { tab: "space" } }))} style={{
          width: "100%", background: "linear-gradient(135deg, #b8860b, #F5A623)", border: "none",
          borderRadius: 8, padding: "10px 16px", fontSize: 12, fontWeight: 600, color: "#0a0a0a",
          cursor: "pointer", fontFamily: FONTS.body,
        }}>
          Go to My Circle →
        </button>
      </div>
    );
  }

  return (
    <div style={{
      background: `linear-gradient(160deg, ${D.panel}, ${D.panel2})`,
      border: `0.5px solid ${D.border}`, borderRadius: 16,
      padding: isMobile ? "12px 14px" : "16px 18px",
      transition: "border-color 0.2s",
    }}
    onMouseEnter={(e) => { e.currentTarget.style.borderColor = D.gold + "44"; }}
    onMouseLeave={(e) => { e.currentTarget.style.borderColor = D.border; }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: "rgba(245,166,35,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
        }}>🗺️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: D.textHi, fontFamily: FONTS.display }}>
            Course Roadmap
          </div>
          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body }}>
            {hasRoadmap ? `${skeleton.length} topics · ${docCount} docs · ${masteredPct}% mastered` : "Pick a folder to view its roadmap"}
          </div>
        </div>
      </div>

      {/* Folder selector */}
      <div style={{ position: "relative", marginBottom: 10 }}>
        <select
          value={selectedFolderId || ""}
          onChange={(e) => setSelectedFolderId(e.target.value)}
          style={{
            width: "100%", boxSizing: "border-box",
            background: `linear-gradient(180deg, ${D.panel}, ${D.ink})`,
            border: `0.5px solid ${D.border}`,
            borderRadius: 10, padding: "10px 36px 10px 14px",
            fontSize: 13, color: D.textHi, fontFamily: FONTS.body,
            outline: "none", cursor: "pointer",
            appearance: "none", WebkitAppearance: "none", MozAppearance: "none",
          }}
        >
          {folders.map((f) => (
            <option key={f.id} value={f.id} style={{ background: D.ink, color: D.textHi }}>
              {f.name}{f.courseCode ? ` · ${f.courseCode}` : ""}
            </option>
          ))}
        </select>
        <span style={{
          position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
          pointerEvents: "none", fontSize: 10, color: D.textMid,
        }}>▼</span>
      </div>

      {/* Content */}
      {hasRoadmap ? (
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
            <div onClick={openFolderInHub} style={{
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

          {/* Open in folder button */}
          <button onClick={openFolderInHub} style={{
            width: "100%", marginTop: 12, background: "linear-gradient(135deg, #b8860b, #F5A623)",
            border: "none", borderRadius: 8, padding: "10px 16px",
            fontSize: 12, fontWeight: 600, color: "#0a0a0a",
            cursor: "pointer", fontFamily: FONTS.body,
          }}>
            Open Roadmap in {selectedFolder?.name || "Folder"} →
          </button>
        </>
      ) : (
        /* No roadmap yet for this folder */
        <div style={{ textAlign: "center", padding: "12px 0" }}>
          <div style={{ fontSize: 11, color: D.textMid, fontFamily: FONTS.body, lineHeight: 1.5, marginBottom: 10 }}>
            No roadmap yet for {selectedFolder?.courseCode || "this folder"} — open the folder to build one.
          </div>
          <button onClick={openFolderInHub} style={{
            background: "linear-gradient(135deg, #b8860b, #F5A623)",
            border: "none", borderRadius: 8, padding: "8px 18px",
            fontSize: 12, fontWeight: 600, color: "#0a0a0a",
            cursor: "pointer", fontFamily: FONTS.body,
          }}>
            Open Folder →
          </button>
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
