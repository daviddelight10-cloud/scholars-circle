import { useState, useEffect, useMemo, useRef, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, formatViewCount, copyShareToken } from "../lib/researchUtils";
import ResourceViewer from "./ResourceViewer";
import { useUserData } from "../contexts/UserDataContext";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const CACHE_TTL = 5 * 60 * 1000;

const emptyMcqRow = () => ({ question: "", options: { A: "", B: "", C: "", D: "" }, correct: "A", explanation: "" });

// ============ MEMOIZED RESOURCE CARD ============
const ResourceCard = memo(function ResourceCard({ resource, isBookmarked, bookmarkBusy, onOpen, onToggleBookmark, onShare }) {
  const badgeColor = getSubjectBadgeColor(resource.subject);
  const icon = getContentTypeIcon(resource.contentType);
  const iconClass = getContentTypeIconClass(resource.contentType);
  const isPending = resource.status === "pending";
  const isPremium = resource.isPremium;
  const saveCount = resource._count?.bookmarks ?? 0;
  const rating = resource.avgRating ? resource.avgRating.toFixed(1) : null;

  return (
    <div style={styles.card}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3949ab")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e2245")}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px",
          background: iconClass === "icon-pdf" ? "#2a0a0a" : iconClass === "icon-mcq" ? "#0f1440" : iconClass === "icon-note" ? "#0f2a1a" : "#1a1000",
          border: iconClass === "icon-pdf" ? "0.5px solid #4a1010" : iconClass === "icon-mcq" ? "0.5px solid #2a3080" : iconClass === "icon-note" ? "0.5px solid #1a4a2a" : "0.5px solid #3a2800",
        }}>{icon}</div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isPending && <span style={styles.pendingTag}>Pending</span>}
          {isPremium && <span style={styles.premiumTag}>Premium</span>}
          <span style={{ fontSize: "10px", fontWeight: 700, padding: "3px 8px", borderRadius: "10px", background: badgeColor.bg, color: badgeColor.text, border: `0.5px solid ${badgeColor.border}` }}>{resource.subject}</span>
        </div>
      </div>
      <div style={styles.cardTitle}>{resource.title}</div>
      <div style={{ fontSize: "11px", color: "#3a3d60", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <span>👁 {formatViewCount(resource.viewCount)}</span>
        {rating && <span>⭐ {rating}</span>}
        {resource.department && <span>· {resource.department}</span>}
        {saveCount > 0 && <span>· 🔖 {saveCount}</span>}
        {(resource.flagCount > 0) && <span style={{ color: "#ff5470" }}>· ⚑ {resource.flagCount}</span>}
      </div>
      <div style={{ display: "flex", gap: "6px" }}>
        <button onClick={() => onOpen(resource.shareToken)} style={styles.openBtn}>Open</button>
        <button onClick={() => onToggleBookmark(resource)} disabled={bookmarkBusy}
          title={isBookmarked ? "Remove from your space" : "Add to your space"}
          style={{ ...styles.iconActionBtn, color: isBookmarked ? "#f5a623" : "#5a6090" }}>
          {isBookmarked ? "★" : "☆"}
        </button>
        <button onClick={() => onShare(resource.shareToken)} style={styles.iconActionBtn}>🔗</button>
      </div>
    </div>
  );
});

// ============ FILTER SHEET ============
function FilterSheet({ open, onClose, filters, setFilters, resources }) {
  const departments = useMemo(() => {
    const set = new Set(resources.map((r) => r.department).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const levels = useMemo(() => {
    const set = new Set(resources.map((r) => r.level).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const semesters = useMemo(() => {
    const set = new Set(resources.map((r) => r.semester).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const subjects = useMemo(() => {
    const set = new Set(resources.map((r) => r.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  if (!open) return null;

  const activeCount = ["department", "level", "semester", "subject"].filter((k) => filters[k] !== "all").length;

  const clearAll = () => {
    setFilters({ department: "all", level: "all", semester: "all", subject: "all" });
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: "420px" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h2 style={styles.modalTitle}>Filters</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={styles.fieldLabel}>Department</label>
          <select value={filters.department} onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))} style={styles.input}>
            <option value="all">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={styles.fieldLabel}>Level</label>
          <select value={filters.level} onChange={(e) => setFilters((p) => ({ ...p, level: e.target.value }))} style={styles.input}>
            <option value="all">All levels</option>
            {levels.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: "14px" }}>
          <label style={styles.fieldLabel}>Semester</label>
          <select value={filters.semester} onChange={(e) => setFilters((p) => ({ ...p, semester: e.target.value }))} style={styles.input}>
            <option value="all">All semesters</option>
            {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: "18px" }}>
          <label style={styles.fieldLabel}>Subject</label>
          <select value={filters.subject} onChange={(e) => setFilters((p) => ({ ...p, subject: e.target.value }))} style={styles.input}>
            <option value="all">All subjects</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={clearAll} style={{ flex: 1, padding: "10px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", fontSize: "13px", fontWeight: 600, color: "#7986cb", cursor: "pointer" }}>
            Clear all{activeCount > 0 && ` (${activeCount})`}
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: "10px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "10px", fontSize: "13px", fontWeight: 700, color: "#c5cae9", cursor: "pointer" }}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ PROGRESS DASHBOARD ============
function ProgressDashboard({ progressData, reviewCount, reviewStats }) {
  if (!progressData) return <div style={styles.emptyState}>Loading progress...</div>;

  const streak = reviewStats?.streak ?? 0;
  const longestStreak = reviewStats?.longestStreak ?? 0;
  const avgEF = reviewStats?.avgEasinessFactor ?? 2.5;
  const mastered = reviewStats?.masteredCount ?? 0;
  const dueCount = reviewStats?.dueCount ?? 0;

  return (
    <div>
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
        <div style={styles.statPill}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#f5a623" }}>{progressData.totalXp}</div>
          <div style={{ fontSize: "11px", color: "#7b82b8" }}>Total XP</div>
        </div>
        <div style={styles.statPill}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#7986cb" }}>Lv {progressData.level}</div>
          <div style={{ fontSize: "11px", color: "#7b82b8" }}>Level</div>
        </div>
        <div style={styles.statPill}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#ff7043" }}>🔥 {streak}</div>
          <div style={{ fontSize: "11px", color: "#7b82b8" }}>Day Streak{longestStreak > streak ? ` (best: ${longestStreak})` : ""}</div>
        </div>
        <div style={styles.statPill}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#ff5470" }}>{reviewCount}</div>
          <div style={{ fontSize: "11px", color: "#7b82b8" }}>Review Queue{dueCount > 0 ? ` (${dueCount} due)` : ""}</div>
        </div>
        <div style={styles.statPill}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#66bb6a" }}>{mastered}</div>
          <div style={{ fontSize: "11px", color: "#7b82b8" }}>SM-2 Mastered</div>
        </div>
        <div style={styles.statPill}>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#9fa8da" }}>{avgEF}</div>
          <div style={{ fontSize: "11px", color: "#7b82b8" }}>Avg Easiness</div>
        </div>
      </div>

      <div style={{ fontSize: "13px", fontWeight: 700, color: "#7b82b8", marginBottom: "14px" }}>Subject Mastery</div>
      {progressData.subjects.length === 0 ? (
        <div style={styles.emptyState}>No quiz attempts yet — take an MCQ to see your progress.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {progressData.subjects.map((s) => (
            <div key={s.subject} style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#c5c9e8" }}>{s.subject}</span>
                <span style={{ fontSize: "12px", fontWeight: 700, color: s.masteryPct >= 70 ? "#66bb6a" : s.masteryPct >= 40 ? "#ffb74d" : "#ff5470" }}>{s.masteryPct}%</span>
              </div>
              <div style={{ height: "8px", background: "#0a0c1e", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${s.masteryPct}%`,
                  background: s.masteryPct >= 70 ? "linear-gradient(90deg, #2a6a3a, #66bb6a)" : s.masteryPct >= 40 ? "linear-gradient(90deg, #3a2800, #ffb74d)" : "linear-gradient(90deg, #4a1010, #ff5470)",
                  borderRadius: "4px", transition: "width 0.3s ease",
                }} />
              </div>
              <div style={{ fontSize: "11px", color: "#3a3d60", marginTop: "6px" }}>{s.correct} / {s.total} questions mastered</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ REVIEW BANNER ============
function ReviewBanner({ reviewData, reviewStats, onReview }) {
  if (!reviewData || reviewData.total === 0) return null;
  const dueCount = reviewData.due.length;
  const avgEF = reviewStats?.avgEasinessFactor;
  const mastered = reviewStats?.masteredCount;

  return (
    <div style={{
      background: dueCount > 0 ? "linear-gradient(135deg, #1a0828, #0d0820)" : "#0d0f20",
      border: dueCount > 0 ? "0.5px solid #5c35a0" : "0.5px solid #1e2245",
      borderRadius: "12px", padding: "16px 18px", marginBottom: "16px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap",
    }}>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: dueCount > 0 ? "#b39ddb" : "#7b82b8" }}>
          {dueCount > 0 ? `📚 ${dueCount} question${dueCount > 1 ? "s" : ""} due for review` : `📅 ${reviewData.total} question${reviewData.total > 1 ? "s" : ""} in review queue`}
        </div>
        <div style={{ fontSize: "11px", color: "#4a5080", marginTop: "2px" }}>
          {dueCount > 0 ? "SM-2 spaced repetition — review now while it's fresh" : "Upcoming reviews — we'll remind you when they're due"}
          {avgEF != null && <span style={{ marginLeft: 8, color: "#5a6090" }}>EF: {avgEF}</span>}
          {mastered != null && mastered > 0 && <span style={{ marginLeft: 8, color: "#4caf50" }}>✓ {mastered} mastered</span>}
        </div>
      </div>
      <button onClick={onReview} style={{
        padding: "8px 18px", borderRadius: "999px",
        background: dueCount > 0 ? "#5c35a0" : "#0f1128",
        border: dueCount > 0 ? "0.5px solid #7c55c0" : "0.5px solid #252860",
        fontSize: "12px", fontWeight: 700, color: dueCount > 0 ? "#e8eaf6" : "#7986cb", cursor: "pointer",
      }}>
        {dueCount > 0 ? "Review now →" : "Practice early"}
      </button>
    </div>
  );
}

// ============ FSRS REVIEW DASHBOARD ============
function FsrsReviewDashboard({ fsrsDue, fsrsStats, onOpenPdf }) {
  if (!fsrsStats) return <div style={styles.emptyState}>Loading FSRS review data...</div>;

  const { totalItems, dueCount, learningCount, masteredCount, streak } = fsrsStats;
  const masteryPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;

  if (totalItems === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📚</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#7b82b8", marginBottom: 6 }}>No PDF review items yet</div>
        <div style={{ fontSize: 13, color: "#4a5080", maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
          Open any PDF in the Research Hub and rate your understanding after reading. The FSRS algorithm will schedule when to revisit each page and the whole document.
        </div>
      </div>
    );
  }

  const duePagesByResource = new Map();
  if (fsrsDue?.pages) {
    for (const p of fsrsDue.pages) {
      const key = p.resourceId;
      if (!duePagesByResource.has(key)) duePagesByResource.set(key, { resource: p.resource, pages: [] });
      duePagesByResource.get(key).pages.push(p);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ ...styles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: dueCount > 0 ? "#ef4444" : "#7b82b8" }}>{dueCount}</div>
          <div style={{ fontSize: 10, color: "#4a5080", marginTop: 2 }}>Due now</div>
        </div>
        <div style={{ ...styles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#f59e0b" }}>{learningCount}</div>
          <div style={{ fontSize: 10, color: "#4a5080", marginTop: 2 }}>Learning</div>
        </div>
        <div style={{ ...styles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#22c55e" }}>{masteredCount}</div>
          <div style={{ fontSize: 10, color: "#4a5080", marginTop: 2 }}>Mastered</div>
        </div>
        <div style={{ ...styles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#7986cb" }}>{totalItems}</div>
          <div style={{ fontSize: 10, color: "#4a5080", marginTop: 2 }}>Total items</div>
        </div>
        {streak > 0 && (
          <div style={{ ...styles.statPill, minWidth: 80 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#ff7043" }}>{streak}</div>
            <div style={{ fontSize: 10, color: "#4a5080", marginTop: 2 }}>Day streak</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#7b82b8" }}>Mastery Progress</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e" }}>{masteredCount}/{totalItems} ({masteryPct}%)</span>
        </div>
        <div style={{ height: 8, background: "#0a0c1e", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${masteryPct}%`, background: "linear-gradient(90deg, #22c55e, #4caf50)", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      {fsrsDue?.wholePdfs?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={styles.sectionLabel}>PDFs to Re-read</div>
          <div style={styles.grid}>
            {fsrsDue.wholePdfs.map((item) => (
              <div key={item.id} style={styles.card} onClick={() => onOpenPdf(item.resource?.shareToken)}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#c5c9e8", marginBottom: 6 }}>{item.resource?.title}</div>
                <div style={{ fontSize: 11, color: "#4a5080" }}>{item.resource?.subject}</div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>Due now</span>
                  <span style={{ fontSize: 10, color: "#4a5080" }}>Reps: {item.reps}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {duePagesByResource.size > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={styles.sectionLabel}>Pages to Review</div>
          {Array.from(duePagesByResource.entries()).map(([resId, group]) => (
            <div key={resId} style={{ ...styles.card, marginBottom: 10, cursor: "default" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c5c9e8", marginBottom: 8 }}>{group.resource?.title}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {group.pages.map((p) => (
                  <button key={p.id} onClick={() => onOpenPdf(group.resource?.shareToken, p.pageIndex)}
                    style={{ padding: "5px 12px", borderRadius: 8, background: "#1a237e", border: "0.5px solid #3949ab", color: "#c5cae9", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    p.{p.pageIndex}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {fsrsDue?.flashcards?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={styles.sectionLabel}>Flashcards Due</div>
          <div style={{ ...styles.card, cursor: "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#c5c9e8" }}>{fsrsDue.flashcards.length} flashcard{fsrsDue.flashcards.length > 1 ? "s" : ""} due</div>
                <div style={{ fontSize: 11, color: "#4a5080", marginTop: 4 }}>
                  Across {new Set(fsrsDue.flashcards.map((f) => f.resourceId)).size} PDF{new Set(fsrsDue.flashcards.map((f) => f.resourceId)).size > 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => {
                const first = fsrsDue.flashcards[0];
                if (first?.resource?.shareToken) onOpenPdf(first.resource.shareToken);
              }}
                style={{ padding: "8px 16px", borderRadius: 8, background: "#1a237e", border: "0.5px solid #3949ab", color: "#c5cae9", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Start Review →
              </button>
            </div>
          </div>
        </div>
      )}

      {dueCount === 0 && totalItems > 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#22c55e" }}>All caught up!</div>
          <div style={{ fontSize: 12, color: "#4a5080", marginTop: 4 }}>No items due for review right now. Come back later.</div>
        </div>
      )}
    </div>
  );
}

export default function ResearchHub({ onBack, streak: propStreak, onStreakUpdate, activeSemester } = {}) {
  const navigate = useNavigate();
  const { setLastActivity } = useUserData();
  const [resources, setResources] = useState([]);
  const [bookmarkedResources, setBookmarkedResources] = useState([]);
  const [myUploads, setMyUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [activeTab, setActiveTab] = useState("foryou");
  const [toast, setToast] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [trialInfo, setTrialInfo] = useState(null);
  const [xpInfo, setXpInfo] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarkBusyId, setBookmarkBusyId] = useState(null);
  const [userDept, setUserDept] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filters, setFilters] = useState({ department: "all", level: "all", semester: "all", subject: "all" });
  const [reviewData, setReviewData] = useState(null);
  const [reviewStats, setReviewStats] = useState(null);
  const [progressData, setProgressData] = useState(null);
  const [fsrsDue, setFsrsDue] = useState(null);
  const [fsrsStats, setFsrsStats] = useState(null);
  const [viewerInitialPage, setViewerInitialPage] = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState("pdf");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mcqRows, setMcqRows] = useState([emptyMcqRow()]);
  const fileInputRef = useRef(null);

  const filterTypes = ["all", "note", "pdf", "mcq", "tutorial_question"];
  const filterLabels = { all: "All", note: "Notes", pdf: "PDF", mcq: "MCQ", tutorial_question: "Tutorial Q" };

  useEffect(() => {
    fetchResources();
    fetchUserInfo();
    fetchUserDept();
    fetchReviewQueue();
    fetchReviewStats();
    fetchFsrsDue();
    fetchFsrsStats();
  }, []);

  useEffect(() => {
    if (activeTab === "space") fetchBookmarks();
    if (activeTab === "uploads") fetchMyUploads();
    if (activeTab === "progress") fetchProgress();
  }, [activeTab]);

  const getAuthHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}` };
  };

  const fetchResources = async () => {
    setLoading(true);
    const cacheKey = "sc_resources_list";
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) { setResources(data); setLoading(false); return; }
      }
    } catch {}
    try {
      const response = await fetch(`${API_BASE}/api/resources`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setResources(data);
        try { localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })); } catch {}
      }
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserInfo = async () => {
    try {
      const parsed = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const token = parsed.authToken;
      if (!token) return;
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const u = data.user;
        if (u) {
          setTrialInfo({ freeTrialViews: u.freeTrialViews ?? 0, freeTrialLimit: u.freeTrialLimit ?? 3, isActivated: u.isActivated ?? false });
          const totalXp = u.totalXp ?? 0;
          setXpInfo({ totalXp, level: Math.floor(totalXp / 100) + 1 });
        }
      }
    } catch {}
  };

  const fetchUserDept = async () => {
    try {
      const res = await fetch(`${API_BASE}/users/me/department`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUserDept(data);
      }
    } catch {}
  };

  const fetchBookmarks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/bookmarks`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedResources(data);
        setBookmarkedIds(new Set(data.map((r) => r.id)));
      }
    } catch {}
  };

  const fetchMyUploads = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/teacher/my`, { headers: getAuthHeaders() });
      if (res.ok) {
        setMyUploads(await res.json());
      }
    } catch {}
  };

  const fetchReviewQueue = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/review-queue`, { headers: getAuthHeaders() });
      if (res.ok) setReviewData(await res.json());
    } catch {}
  };

  const fetchReviewStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/review-queue/stats`, { headers: getAuthHeaders() });
      if (res.ok) setReviewStats(await res.json());
    } catch {}
  };

  const fetchFsrsDue = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/pdf-review/due`, { headers: getAuthHeaders() });
      if (res.ok) setFsrsDue(await res.json());
    } catch {}
  };

  const fetchFsrsStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/pdf-review/stats`, { headers: getAuthHeaders() });
      if (res.ok) setFsrsStats(await res.json());
    } catch {}
  };

  const handleQuizComplete = useCallback((data) => {
    // Refresh review queue and stats after quiz submission
    fetchReviewQueue();
    fetchReviewStats();
    fetchFsrsDue();
    fetchFsrsStats();
    // Notify parent (App.jsx) of streak update for universal sync
    if (onStreakUpdate && data.streak != null) onStreakUpdate(data.streak, data.longestStreak);
  }, [onStreakUpdate]);

  const fetchProgress = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/progress`, { headers: getAuthHeaders() });
      if (res.ok) setProgressData(await res.json());
    } catch {}
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleShare = useCallback(async (token) => {
    const success = await copyShareToken(token);
    if (success) showToast("Link copied! 🔗");
  }, []);

  const handleOpen = useCallback((token) => {
    const res = resources.find((r) => r.shareToken === token);
    if (res) {
      setLastActivity({ resourceId: res.id, resourceTitle: res.title, subjectId: res.subject });
    }
    setViewerToken(token);
  }, [resources, setLastActivity]);

  const toggleBookmark = useCallback(async (resource) => {
    const isBookmarked = bookmarkedIds.has(resource.id);
    setBookmarkBusyId(resource.id);
    const prevIds = bookmarkedIds;
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(resource.id); else next.add(resource.id);
      return next;
    });
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resource.id}/bookmark`, {
        method: isBookmarked ? "DELETE" : "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast(isBookmarked ? "Removed from your space" : "Added to your space ✓");
        if (isBookmarked) {
          setBookmarkedResources((prev) => prev.filter((r) => r.id !== resource.id));
        } else {
          setBookmarkedResources((prev) => [resource, ...prev]);
        }
      } else {
        setBookmarkedIds(prevIds);
        showToast("Failed to update bookmark");
      }
    } catch {
      setBookmarkedIds(prevIds);
      showToast("Network error — try again");
    } finally {
      setBookmarkBusyId(null);
    }
  }, [bookmarkedIds]);

  const openUpload = (type) => {
    setUploadType(type);
    setUploadTitle("");
    setUploadSubject("");
    setUploadFile(null);
    setUploadPreview(null);
    setUploadProgress(0);
    setMcqRows([emptyMcqRow()]);
    setShowUploadModal(true);
  };

  const closeUpload = () => {
    if (uploading) return;
    setShowUploadModal(false);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(null);
  };

  const handleFileSelected = (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { showToast("File too large — 20MB max"); return; }
    setUploadFile(file);
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setUploadPreview(url);
    } else {
      setUploadPreview(null);
    }
  };

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const submitFileUpload = () => {
    if (!uploadTitle.trim() || !uploadSubject.trim() || !uploadFile) {
      showToast("Add a title, subject, and file first");
      return;
    }
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("title", uploadTitle.trim());
    formData.append("subject", uploadSubject.trim());
    formData.append("contentType", uploadType);
    formData.append("isPremium", "false");
    formData.append("file", uploadFile);

    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resource = JSON.parse(xhr.responseText);
          setResources((prev) => {
            const updated = [resource, ...prev];
            try { localStorage.setItem("sc_resources_list", JSON.stringify({ data: updated, ts: Date.now() })); } catch {}
            return updated;
          });
        } catch {}
        setShowUploadModal(false);
        if (uploadPreview) URL.revokeObjectURL(uploadPreview);
        setUploadPreview(null);
        showToast("Uploaded ✓");
        setActiveTab("uploads");
        fetchMyUploads();
      } else {
        showToast("Upload failed");
      }
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      showToast("Upload failed — check your connection");
    });
    xhr.open("POST", `${API_BASE}/api/resources`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  const updateMcqRow = (index, patch) =>
    setMcqRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const updateMcqOption = (rowIndex, optKey, value) =>
    setMcqRows((prev) => prev.map((row, i) => (i === rowIndex ? { ...row, options: { ...row.options, [optKey]: value } } : row)));
  const addMcqRow = () => setMcqRows((prev) => [...prev, emptyMcqRow()]);
  const removeMcqRow = (index) => setMcqRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const submitMcqUpload = () => {
    if (!uploadTitle.trim() || !uploadSubject.trim()) { showToast("Add a title and subject first"); return; }
    const incomplete = mcqRows.some((row) => !row.question.trim() || Object.values(row.options).some((o) => !o.trim()));
    if (incomplete) { showToast("Fill in every question and all 4 options"); return; }
    setUploading(true);

    const formData = new FormData();
    formData.append("title", uploadTitle.trim());
    formData.append("subject", uploadSubject.trim());
    formData.append("contentType", "mcq");
    formData.append("isPremium", "false");
    formData.append("mcqData", JSON.stringify(mcqRows));

    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resource = JSON.parse(xhr.responseText);
          setResources((prev) => {
            const updated = [resource, ...prev];
            try { localStorage.setItem("sc_resources_list", JSON.stringify({ data: updated, ts: Date.now() })); } catch {}
            return updated;
          });
        } catch {}
        setShowUploadModal(false);
        showToast("MCQs submitted ✓");
        setActiveTab("uploads");
        fetchMyUploads();
      } else {
        showToast("Submission failed");
      }
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      showToast("Submission failed — check your connection");
    });
    xhr.open("POST", `${API_BASE}/api/resources`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  // Derived list of subjects from resources (for upload datalist)
  const subjects = useMemo(() => {
    const set = new Set(resources.map((r) => r.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  // For You: filter by user's department + level + semester if available
  const forYouResources = useMemo(() => {
    if (!userDept || !userDept.department) return [];
    const levelMap = { 1: "100 Level", 2: "200 Level", 3: "300 Level", 4: "400 Level" };
    const userLevel = levelMap[userDept.yearLevel] || null;
    const userSem = userDept.semester || activeSemester || null;
    return resources.filter((r) => {
      if (r.uploader?.role === "STUDENT") return false;
      const deptMatches = r.department === userDept.department ||
        (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === userDept.department));
      if (!deptMatches) return false;
      if (userLevel && r.level && r.level !== userLevel) return false;
      if (userSem && r.semester && r.semester !== userSem) return false;
      return true;
    });
  }, [resources, userDept, activeSemester]);

  // Tab-based source list
  const tabResources = useMemo(() => {
    if (activeTab === "foryou") return forYouResources;
    if (activeTab === "space") return bookmarkedResources;
    if (activeTab === "uploads") return myUploads;
    return resources;
  }, [activeTab, resources, forYouResources, bookmarkedResources, myUploads]);

  const activeFilterCount = ["department", "level", "semester", "subject"].filter((k) => filters[k] !== "all").length;

  // Filtered + sorted
  const visibleResources = useMemo(() => {
    let list = tabResources.filter((r) => {
      const matchesSearch = search === "" || r.title.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase());
      const matchesType = activeFilter === "all" || r.contentType === activeFilter;
      const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
      const matchesLevel = filters.level === "all" || r.level === filters.level;
      const matchesSemester = filters.semester === "all" || r.semester === filters.semester;
      const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
      return matchesSearch && matchesType && matchesDept && matchesLevel && matchesSemester && matchesSubject;
    });
    const sorted = [...list];
    if (sortBy === "views") sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    else if (sortBy === "recent") sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sortBy === "bookmarks") sorted.sort((a, b) => (b._count?.bookmarks || 0) - (a._count?.bookmarks || 0));
    return sorted;
  }, [tabResources, search, activeFilter, filters, sortBy]);

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} initialPage={viewerInitialPage} onBack={() => { setViewerToken(null); setViewerInitialPage(null); }} onQuizComplete={handleQuizComplete} />;
  }

  const tabLabel = { foryou: "For You", all: "All Materials", space: "My Space", uploads: "My Uploads", progress: "Progress", fsrs: "Review" }[activeTab];
  const emptyMessage = {
    foryou: userDept && userDept.department ? "No materials match your department and level yet — check All Materials for everything." : "Set your department to see materials curated for you.",
    all: "No resources found. Try a different search.",
    space: "Nothing saved yet — tap the ☆ on any resource to add it to your space.",
    uploads: "You haven't uploaded anything yet — tap + Add material to share your first note, PDF, or MCQ set.",
  }[activeTab];

  const handleReview = () => {
    if (reviewData && reviewData.due.length > 0) {
      const firstDue = reviewData.due[0];
      if (firstDue.resource?.shareToken) setViewerToken(firstDue.resource.shareToken);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
      <button onClick={() => onBack ? onBack() : navigate("/app")} style={styles.backBtn}>← Back</button>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "14px", marginBottom: "20px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e8eaf6", margin: 0 }}>Research Hub</h1>
            {xpInfo && (
              <span style={{
                padding: "4px 12px", borderRadius: "12px",
                background: "linear-gradient(135deg, #1a237e, #283593)",
                border: "0.5px solid #3949ab", fontSize: "12px", fontWeight: 700,
                color: "#c5cae9", display: "flex", alignItems: "center", gap: "6px",
              }}>
                ⭐ Lv {xpInfo.level} <span style={{ color: "#7986cb", fontSize: "11px" }}>{xpInfo.totalXp} XP</span>
              </span>
            )}
            {(propStreak != null ? propStreak : reviewStats?.streak) > 0 && (
              <span style={{
                padding: "4px 12px", borderRadius: "12px",
                background: "linear-gradient(135deg, #bf360c, #d84315)",
                border: "0.5px solid #ff7043", fontSize: "12px", fontWeight: 700,
                color: "#ffccbc", display: "flex", alignItems: "center", gap: "4px",
              }}>
                🔥 {(propStreak ?? reviewStats?.streak) ?? 0} day streak
                {reviewStats?.longestStreak > (propStreak ?? reviewStats?.streak) && (
                  <span style={{ color: "#ffab91", fontSize: "10px" }}>best: {reviewStats.longestStreak}</span>
                )}
              </span>
            )}
          </div>
          <p style={{ fontSize: "14px", color: "#7b82b8" }}>Find, save, and share study materials</p>
          {trialInfo && !trialInfo.isActivated && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "10px", padding: "6px 14px", background: "#0f0a28", border: "0.5px solid #5c35a0", borderRadius: "20px", fontSize: "12px", color: "#b39ddb" }}>
              ⭐ Premium resources require upgrade — <span style={{ textDecoration: "underline", cursor: "pointer", color: "#b39ddb" }} onClick={() => navigate("/app#upgrade")}>Upgrade now →</span>
            </div>
          )}
        </div>
        <button onClick={() => openUpload("pdf")} style={styles.addBtn}>+ Add material</button>
      </div>

      {/* Review Banner */}
      <ReviewBanner reviewData={reviewData} reviewStats={reviewStats} onReview={handleReview} />

      {/* Tabs */}
      <div style={styles.tabRow}>
        {[["foryou", "For You"], ["all", "All Materials"], ["space", "My Space"], ["uploads", "My Uploads"], ["progress", "Progress"], ["fsrs", "Review"]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={activeTab === key ? styles.tabActive : styles.tab}>
            {label}
            {key === "space" && bookmarkedIds.size > 0 && <span style={styles.tabCount}>{bookmarkedIds.size}</span>}
            {key === "progress" && reviewData && reviewData.total > 0 && <span style={styles.tabCount}>{reviewData.total}</span>}
            {key === "fsrs" && fsrsStats && fsrsStats.dueCount > 0 && <span style={styles.tabCount}>{fsrsStats.dueCount}</span>}
          </button>
        ))}
      </div>

      {/* Progress Tab */}
      {activeTab === "progress" ? (
        <ProgressDashboard progressData={progressData} reviewCount={reviewData?.total || 0} reviewStats={reviewStats} />
      ) : activeTab === "fsrs" ? (
        <FsrsReviewDashboard fsrsDue={fsrsDue} fsrsStats={fsrsStats} onOpenPdf={(token, page) => {
          const res = resources.find((r) => r.shareToken === token);
          if (res) setLastActivity({ resourceId: res.id, resourceTitle: res.title, subjectId: res.subject });
          setViewerInitialPage(page || null);
          setViewerToken(token);
        }} />
      ) : (
        <>
          {/* Search + Filter button + Sort */}
          <div style={{ display: "flex", gap: "10px", marginBottom: "14px", flexWrap: "wrap" }}>
            <div style={{ ...styles.searchWrap, flex: "1 1 240px" }}>
              <span style={{ color: "#3a3d60", fontSize: "16px" }}>🔍</span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, PDFs, MCQs…" style={styles.searchInput} />
            </div>
            <button onClick={() => setShowFilterSheet(true)} style={{
              ...styles.select, display: "flex", alignItems: "center", gap: "6px",
              background: activeFilterCount > 0 ? "#1a237e" : "#0f1128",
              border: activeFilterCount > 0 ? "0.5px solid #3949ab" : "0.5px solid #1e2245",
              color: activeFilterCount > 0 ? "#c5cae9" : "#9fa8da",
            }}>
              <span>🔧 Filters</span>
              {activeFilterCount > 0 && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: "999px", fontSize: "10px", padding: "1px 6px" }}>{activeFilterCount}</span>}
            </button>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={styles.select}>
              <option value="recent">Most recent</option>
              <option value="views">Most viewed</option>
              <option value="bookmarks">Most saved</option>
            </select>
          </div>

          {/* Type filter chips */}
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", marginBottom: "20px", paddingBottom: "4px" }}>
            {filterTypes.map((type) => (
              <button key={type} onClick={() => setActiveFilter(type)} style={activeFilter === type ? styles.chipActive : styles.chip}>
                {filterLabels[type]}
              </button>
            ))}
          </div>

          <div style={styles.sectionLabel}>{tabLabel.toUpperCase()}</div>

          {/* Resource Grid */}
          {loading && (activeTab === "all" || activeTab === "foryou") ? (
            <div style={styles.grid}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={styles.skeleton} />
              ))}
            </div>
          ) : visibleResources.length === 0 ? (
            <div style={styles.emptyState}>{emptyMessage}</div>
          ) : (
            <div style={styles.grid}>
              {visibleResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  isBookmarked={bookmarkedIds.has(resource.id)}
                  bookmarkBusy={bookmarkBusyId === resource.id}
                  onOpen={handleOpen}
                  onToggleBookmark={toggleBookmark}
                  onShare={handleShare}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Filter Sheet */}
      <FilterSheet
        open={showFilterSheet}
        onClose={() => setShowFilterSheet(false)}
        filters={filters}
        setFilters={setFilters}
        resources={resources}
      />

      {/* Toast */}
      {toast && (
        <div style={styles.toast}>
          <span>✓</span>{toast}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div style={styles.overlay} onClick={closeUpload}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={styles.modalTitle}>Add material</h2>
              <button onClick={closeUpload} style={styles.closeBtn}>✕</button>
            </div>

            <div style={styles.segmentRow}>
              {[["pdf", "PDF"], ["image", "Image"], ["docx", "DOCX"], ["pptx", "PPTX"], ["txt", "TXT"], ["note", "Note"], ["mcq", "MCQ set"]].map(([key, label]) => (
                <button key={key} onClick={() => setUploadType(key)} style={uploadType === key ? styles.segActive : styles.seg}>{label}</button>
              ))}
            </div>

            <div style={{ marginBottom: "12px" }}>
              <label style={styles.fieldLabel}>Title</label>
              <input value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Upper Limb — Brachial Plexus Notes" style={styles.input} />
            </div>
            <div style={{ marginBottom: "12px" }}>
              <label style={styles.fieldLabel}>Subject / course code</label>
              <input list="subjectOptions" value={uploadSubject} onChange={(e) => setUploadSubject(e.target.value)} placeholder="e.g. BIO 111" style={styles.input} />
              <datalist id="subjectOptions">{subjects.map((s) => <option key={s} value={s} />)}</datalist>
            </div>

            {uploadType !== "mcq" ? (
              <>
                <label
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  style={{
                    ...styles.dropzone,
                    borderColor: dragOver ? "#3949ab" : uploadFile ? "#2a6a3a" : "#252860",
                    background: dragOver ? "#0f1240" : "#0a0c1e",
                  }}
                >
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png,.docx,.doc,.txt,.pptx,.webp,.gif,.bmp" onChange={handleFilePick} style={{ display: "none" }} ref={fileInputRef} />
                  {uploadPreview ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <img src={uploadPreview} alt="Preview" style={{ maxWidth: "100%", maxHeight: "160px", borderRadius: "8px", objectFit: "contain" }} />
                      <span style={{ fontSize: "12px", color: "#a5d6a7" }}>✓ {uploadFile.name}</span>
                    </div>
                  ) : uploadFile ? (
                    <span style={{ fontSize: "13px", color: "#a5d6a7" }}>✓ {uploadFile.name}</span>
                  ) : (
                    <span style={{ fontSize: "13px", color: "#4a5080" }}>
                      {dragOver ? "Drop file here" : "Tap to choose or drag a file · PDF, JPG, PNG, DOCX · max 20MB"}
                    </span>
                  )}
                </label>

                {uploading && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ height: "6px", background: "#0a0c1e", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, #3949ab, #5c6bc0)", borderRadius: "4px", transition: "width 0.2s" }} />
                    </div>
                    <div style={{ fontSize: "11px", color: "#7986cb", textAlign: "center", marginTop: "4px" }}>{uploadProgress}%</div>
                  </div>
                )}

                <button onClick={submitFileUpload} disabled={uploading || !uploadFile} style={{ ...styles.submit, opacity: uploading || !uploadFile ? 0.5 : 1, cursor: uploading || !uploadFile ? "not-allowed" : "pointer" }}>
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </>
            ) : (
              <>
                {mcqRows.map((row, i) => (
                  <div key={i} style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "14px", marginBottom: "10px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8" }}>Question {i + 1}</span>
                      {mcqRows.length > 1 && <button onClick={() => removeMcqRow(i)} style={{ background: "none", border: "none", color: "#ef9a9a", fontSize: "11px", cursor: "pointer" }}>Remove</button>}
                    </div>
                    <input value={row.question} onChange={(e) => updateMcqRow(i, { question: e.target.value })} placeholder="Question text" style={{ ...styles.input, marginBottom: "8px" }} />
                    {Object.entries(row.options).map(([key, value]) => (
                      <div key={key} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <input type="radio" name={`correct-${i}`} checked={row.correct === key} onChange={() => updateMcqRow(i, { correct: key })} title="Mark as correct" style={{ accentColor: "#3949ab" }} />
                        <span style={{ fontSize: "11px", fontWeight: 700, color: row.correct === key ? "#66bb6a" : "#4a5080", width: "16px" }}>{key}</span>
                        <input value={value} onChange={(e) => updateMcqOption(i, key, e.target.value)} placeholder={`Option ${key}`} style={{ ...styles.input, flex: 1 }} />
                      </div>
                    ))}
                    <textarea value={row.explanation} onChange={(e) => updateMcqRow(i, { explanation: e.target.value })} placeholder="Brief explanation (optional but recommended)" style={{ ...styles.input, minHeight: "50px", resize: "vertical", marginTop: "6px" }} />
                  </div>
                ))}
                <button onClick={addMcqRow} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px dashed #2a2d4a", background: "none", color: "#7b82b8", fontSize: "12.5px", fontWeight: 600, cursor: "pointer", marginBottom: "14px" }}>+ Add another question</button>

                {uploading && (
                  <div style={{ marginBottom: "14px" }}>
                    <div style={{ height: "6px", background: "#0a0c1e", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, #3949ab, #5c6bc0)", borderRadius: "4px", transition: "width 0.2s" }} />
                    </div>
                  </div>
                )}

                <button onClick={submitMcqUpload} disabled={uploading} style={{ ...styles.submit, opacity: uploading ? 0.5 : 1, cursor: uploading ? "not-allowed" : "pointer" }}>
                  {uploading ? "Submitting..." : "Submit MCQs"}
                </button>
              </>
            )}

            <p style={styles.modalFootnote}>
              Your upload will appear in My Uploads immediately.
            </p>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeup {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

const styles = {
  backBtn: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "13px", color: "#7b82b8", cursor: "pointer", marginBottom: "20px" },
  addBtn: { padding: "10px 20px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#c5cae9", cursor: "pointer" },
  tabRow: { display: "flex", gap: "6px", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "999px", padding: "4px", marginBottom: "16px", width: "fit-content", flexWrap: "wrap" },
  tab: { padding: "8px 16px", borderRadius: "999px", background: "none", border: "none", fontSize: "13px", fontWeight: 600, color: "#4a5080", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },
  tabActive: { padding: "8px 16px", borderRadius: "999px", background: "#1a237e", border: "none", fontSize: "13px", fontWeight: 700, color: "#c5cae9", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" },
  tabCount: { background: "rgba(26,35,126,0.4)", borderRadius: "999px", fontSize: "11px", padding: "1px 7px" },
  searchWrap: { display: "flex", alignItems: "center", gap: "10px", background: "#0f1128", border: "0.5px solid #1e2245", borderRadius: "22px", padding: "10px 16px" },
  searchInput: { flex: 1, background: "none", border: "none", outline: "none", fontSize: "14px", color: "#9fa8da" },
  select: { background: "#0f1128", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "10px 12px", fontSize: "13px", color: "#9fa8da", cursor: "pointer", outline: "none" },
  chip: { padding: "6px 14px", borderRadius: "20px", background: "#0f1128", border: "0.5px solid #252860", fontSize: "12px", fontWeight: 600, color: "#5a6090", cursor: "pointer", whiteSpace: "nowrap" },
  chipActive: { padding: "6px 14px", borderRadius: "20px", background: "#1a237e", border: "0.5px solid #3949ab", fontSize: "12px", fontWeight: 600, color: "#c5cae9", cursor: "pointer", whiteSpace: "nowrap" },
  sectionLabel: { fontSize: "12px", fontWeight: 700, color: "#3a3d60", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "12px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  skeleton: { background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "16px", height: "140px" },
  emptyState: { textAlign: "center", padding: "60px 20px", fontSize: "14px", color: "#3a3d60" },
  card: { background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "14px", cursor: "pointer", transition: "borderColor 0.15s" },
  pendingTag: { fontSize: "9px", fontWeight: 700, padding: "3px 7px", borderRadius: "8px", background: "rgba(255,84,112,0.14)", color: "#ff5470", whiteSpace: "nowrap" },
  premiumTag: { fontSize: "9px", fontWeight: 700, padding: "3px 7px", borderRadius: "8px", background: "rgba(245,166,35,0.14)", color: "#f5a623", whiteSpace: "nowrap" },
  cardTitle: { fontSize: "13.5px", fontWeight: 700, color: "#c5c9e8", lineHeight: 1.35, marginBottom: "8px", minHeight: "36px" },
  openBtn: { flex: 1, padding: "8px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "7px", fontSize: "11px", fontWeight: 600, color: "#9fa8da", cursor: "pointer", textAlign: "center" },
  iconActionBtn: { width: "32px", height: "32px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "14px" },
  statPill: { background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "16px 20px", textAlign: "center", minWidth: "100px" },
  toast: { position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#0f2a1a", border: "0.5px solid #2a6a3a", color: "#a5d6a7", padding: "10px 20px", borderRadius: "20px", fontSize: "13px", fontWeight: 600, zIndex: 999, display: "flex", alignItems: "center", gap: "8px", animation: "fadeup 0.2s ease" },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  modal: { background: "#0d0f20", border: "0.5px solid #2a2d4a", borderRadius: "18px", padding: "26px", width: "100%", maxWidth: "460px", maxHeight: "86vh", overflowY: "auto" },
  modalTitle: { fontSize: "1.3rem", fontWeight: 800, color: "#e8eaf6", margin: 0 },
  closeBtn: { background: "none", border: "none", color: "#4a5080", fontSize: "16px", cursor: "pointer", padding: "4px" },
  segmentRow: { display: "flex", gap: "6px", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "4px", marginBottom: "16px" },
  fieldLabel: { fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" },
  input: { width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#9fa8da", outline: "none", fontFamily: "inherit" },
  seg: { flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: "none", fontSize: "13px", fontWeight: 600, color: "#4a5080", cursor: "pointer" },
  segActive: { flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: "#1a237e", fontSize: "13px", fontWeight: 700, color: "#c5cae9", cursor: "pointer" },
  dropzone: { display: "block", textAlign: "center", padding: "26px 14px", border: "1.5px dashed #252860", borderRadius: "12px", cursor: "pointer", marginBottom: "14px", transition: "all 0.15s" },
  submit: { width: "100%", padding: "12px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#c5cae9" },
  modalFootnote: { fontSize: "11px", color: "#4a5080", marginTop: "14px", lineHeight: 1.4 },
};
