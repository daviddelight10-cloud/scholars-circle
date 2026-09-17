import { useState, useEffect, useCallback, useMemo } from "react";
import { getMyProfile } from "../lib/profileApi.js";
import NotificationBellImproved from "../features/NotificationBellImproved";
import DailyReview from "../features/research-hub/DailyReview.jsx";
import StreakSurvival from "../features/streak-survival/StreakSurvival.jsx";
import { listCommunityFolders, bookmarkFolder } from "../lib/foldersApi.js";
import { loadSave, mutate } from "../features/streak-survival/survivalStore.js";
import { listRecentDocs, weakestSubject } from "../lib/homeUtils.js";
import { getPdfReadingProgress, tileTintStyle } from "../lib/researchUtils.js";
import GameBar from "./home/GameBar.jsx";
import HomeHero from "./home/HomeHero.jsx";
import { ShopSheet, BoardSheet, StatsSheet, GoalSheet } from "./home/HomeSheets.jsx";
import HIcon from "./home/HIcon.jsx";
import { API_BASE } from "../lib/constants";
import "../home.css";

const FREEZE_COST = 50;

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { "Content-Type": "application/json", Authorization: `Bearer ${authData.authToken}` };
  } catch {
    return { "Content-Type": "application/json" };
  }
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function relTime(ts) {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

const AV_COLORS = ["#FFC55C", "#9DB8E8", "#6EE7A0", "#C0B2FF", "#F9A8D4", "#7CC7FF"];
function avColor(name) {
  let h = 0;
  for (let i = 0; i < (name || "").length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AV_COLORS[Math.abs(h) % AV_COLORS.length];
}
function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return (p.length >= 2 ? p[0][0] + p[1][0] : name.slice(0, 2)).toUpperCase();
}

export default function Dashboard({
  userName, stats, subjects, mastery, dueCards, history,
  onStartSpaced, onStartSubject, onOpenTab, onOpenLeaderboard,
  onOpenAI, onOpenLearn, onOpenStudy, onOpenResource, token, authUser,
}) {
  const [fsrsStats, setFsrsStats] = useState(null);
  const [fsrsAnalytics, setFsrsAnalytics] = useState(null);
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [mcqPracticeItems, setMcqPracticeItems] = useState(null);
  const [save, setSave] = useState(() => ({ ...loadSave() }));
  const [openSheet, setOpenSheet] = useState(null); // 'shop' | 'board' | 'stats' | 'goal'
  const [toast, setToast] = useState(null);
  const [recents, setRecents] = useState(() => listRecentDocs());

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const refreshSave = useCallback(() => setSave({ ...loadSave() }), []);

  const fetchFsrsStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() });
      if (res.ok) setFsrsStats(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchFsrsStats(); }, [fetchFsrsStats]);

  useEffect(() => {
    const onRated = () => { try { localStorage.removeItem("sc_fsrs_stats"); } catch {} fetchFsrsStats(); };
    const onRecent = () => setRecents(listRecentDocs());
    window.addEventListener("sc-fsrs-rated", onRated);
    window.addEventListener("sc-recent-doc", onRecent);
    return () => {
      window.removeEventListener("sc-fsrs-rated", onRated);
      window.removeEventListener("sc-recent-doc", onRecent);
    };
  }, [fetchFsrsStats]);

  // Quick analytics (only fetched when the stats sheet opens)
  useEffect(() => {
    if (openSheet !== "stats" || fsrsAnalytics) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/resources/fsrs/analytics?days=7`, { headers: getAuthHeaders() });
        if (res.ok) setFsrsAnalytics(await res.json());
      } catch {}
    })();
  }, [openSheet, fsrsAnalytics]);

  const [resourceCounts, setResourceCounts] = useState({ dept: 0, saved: 0, uploads: 0 });
  const [communityFolders, setCommunityFolders] = useState([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [savedFolderIds, setSavedFolderIds] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState([]);
  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchHubData() {
      const headers = getAuthHeaders();
      let resources = [];
      try {
        const cached = localStorage.getItem("sc_resources_list");
        if (cached) {
          const parsed = JSON.parse(cached);
          resources = parsed.data || parsed;
          if (parsed.ts && Date.now() - parsed.ts > 5 * 60 * 1000) resources = [];
        }
      } catch {}
      if (resources.length === 0) {
        try {
          const res = await fetch(`${API_BASE}/api/resources`, { headers });
          if (res.ok) {
            resources = await res.json();
            try { localStorage.setItem("sc_resources_list", JSON.stringify({ data: resources, ts: Date.now() })); } catch {}
          }
        } catch {}
      }
      let profile = null;
      try {
        const profileData = await getMyProfile();
        if (profileData?.profile) profile = profileData.profile;
        if (profileData?.userDept) profile = { ...profile, ...profileData.userDept };
      } catch {}
      let saved = 0;
      try {
        const bmRes = await fetch(`${API_BASE}/api/resources/bookmarks`, { headers });
        if (bmRes.ok) saved = (await bmRes.json()).length;
      } catch {}
      let uploads = 0;
      try {
        const upRes = await fetch(`${API_BASE}/api/resources/teacher/my`, { headers });
        if (upRes.ok) uploads = (await upRes.json()).length;
      } catch {}
      let folders = [];
      try {
        folders = await listCommunityFolders();
      } catch {}
      let board = [];
      try {
        const lbRes = await fetch(`${API_BASE}/users/leaderboard`, { headers });
        if (lbRes.ok) {
          const data = await lbRes.json();
          board = Array.isArray(data) ? data : [];
        }
      } catch {}
      if (cancelled) return;

      const deptId = profile?.departmentId || profile?.department?.id;
      const deptName = profile?.department?.name || profile?.department;
      const matchesDept = (r) => {
        if (deptId && r.resourceDepts) return r.resourceDepts.some((rd) => String(rd.department?.id) === String(deptId));
        if (deptName && r.resourceDepts) return r.resourceDepts.some((rd) => rd.department?.name === deptName);
        return false;
      };
      const deptResources = resources.filter((r) => r.status !== "rejected" && matchesDept(r));

      setUserProfile(profile);
      setResourceCounts({ dept: deptResources.length, saved, uploads });
      setCommunityFolders(Array.isArray(folders) ? folders : []);
      setFoldersLoaded(true);
      setLeaderboard(board);
    }
    fetchHubData();
    return () => { cancelled = true; };
  }, [token]);

  const sm2DueCount = dueCards?.length || 0;
  const firstRun = fsrsStats != null && (fsrsStats.totalItems || 0) === 0;
  const weakest = useMemo(() => weakestSubject(fsrsStats), [fsrsStats]);

  const handleReviewQuestions = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/due-mcqs?limit=20`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []).filter((i) => i.mcq);
        if (items.length > 0) { setMcqPracticeItems(items); return; }
      }
    } catch {}
    onStartSpaced();
  }, [onStartSpaced]);

  const handleReviewReadings = useCallback(async () => {
    if (onOpenResource) {
      try {
        const res = await fetch(`${API_BASE}/api/resources/fsrs/due?limit=50`, { headers: getAuthHeaders() });
        if (res.ok) {
          const data = await res.json();
          const reviewItem = (data.items || []).find(
            (item) => ["mcq", "legacy_mcq", "flashcard"].includes(item.itemType) && item.resource?.shareToken
          );
          if (reviewItem) { onOpenResource(reviewItem.resource.shareToken, reviewItem.pageIndex); return; }
        }
      } catch {}
    }
    onOpenTab?.("research-hub");
  }, [onOpenTab, onOpenResource]);

  const openResearchHub = useCallback((tab, subTab) => {
    window.dispatchEvent(new CustomEvent("sc-open-research-hub", { detail: { tab, subTab } }));
  }, []);

  // For-you community folders: same-uni first, then bookmark count, top 3.
  const forYouFolders = useMemo(() => {
    const uniId = userProfile?.universityId || userProfile?.university?.id;
    const deptId = userProfile?.departmentId || userProfile?.department?.id;
    const weak = (weakest || "").toLowerCase();
    const scored = communityFolders
      .filter((f) => !f.deletedAt && (f._count?.resources || 0) > 0)
      .map((f) => {
        const sameUni = uniId && f.universityId && String(f.universityId) === String(uniId);
        const sameDept = deptId && (f.folderDepts || []).some((fd) => String(fd.department?.id) === String(deptId));
        const text = `${f.name || ""} ${f.courseCode || ""} ${(f.folderDepts || []).map((fd) => fd.department?.name || "").join(" ")}`.toLowerCase();
        const weakMatch = weak && text.includes(weak);
        let reason = "trend";
        if (weakMatch) reason = "weak";
        else if (sameDept) reason = "dept";
        else if (sameUni) reason = "uni";
        const score = (weakMatch ? 4 : 0) + (sameDept ? 2 : 0) + (sameUni ? 1 : 0);
        return { ...f, _reason: reason, _score: score };
      })
      .sort((a, b) => (b._score - a._score) || (b._count?.folderBookmarks || 0) - (a._count?.folderBookmarks || 0));
    // keep reason variety: if all picked are 'trend', fine — tags still render
    return scored.slice(0, 3);
  }, [communityFolders, userProfile, weakest]);

  const insightText = weakest
    ? `${weakest} retention needs work — rebuild it with these.`
    : "Folders picked for your department and courses.";

  const handleSaveFolder = useCallback(async (e, folder) => {
    e.stopPropagation();
    if (savedFolderIds.has(folder.id)) return;
    try {
      await bookmarkFolder(folder.id);
      setSavedFolderIds((s) => new Set(s).add(folder.id));
      setResourceCounts((c) => ({ ...c, saved: c.saved + 1 }));
      showToast("Saved to My Space");
    } catch {
      showToast("Couldn't save that folder");
    }
  }, [savedFolderIds, showToast]);

  const handleOpenFolder = useCallback((folder) => {
    window.dispatchEvent(new CustomEvent("sc-open-research-hub", { detail: { tab: "community", folderId: folder.id } }));
  }, []);

  const handleBuyFreeze = useCallback(() => {
    let ok = false;
    mutate((s) => {
      if ((s.gems || 0) >= FREEZE_COST) { s.gems -= FREEZE_COST; s.freezes = (s.freezes || 0) + 1; ok = true; }
    });
    if (ok) { refreshSave(); showToast("Streak Freeze added"); }
    else showToast("Not enough gems");
  }, [refreshSave, showToast]);

  const handleSetGoal = useCallback(async (n) => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/daily-goal`, {
        method: "PUT", headers: getAuthHeaders(), body: JSON.stringify({ dailyGoal: n }),
      });
      if (res.ok) {
        const data = await res.json();
        setFsrsStats((s) => (s ? { ...s, dailyGoal: data.dailyGoal } : s));
        showToast(`Daily goal set to ${data.dailyGoal}`);
      }
    } catch { showToast("Couldn't update goal"); }
    setOpenSheet(null);
  }, [showToast]);

  const handleInvite = useCallback(async () => {
    const text = "Join me on Scholars Circle — let's keep our study streaks going together.";
    try {
      if (navigator.share) { await navigator.share({ title: "Scholars Circle", text }); return; }
      await navigator.clipboard.writeText(text);
      showToast("Invite text copied");
    } catch {}
  }, [showToast]);

  const greeting = firstRun ? "Welcome," : `Good ${greetingWord()},`;
  const displayName = userName || authUser?.username || authUser?.name || "Scholar";
  const streak = stats?.streak || fsrsStats?.streak || 0;


  const reasonTag = (f) => {
    switch (f._reason) {
      case "weak": return { icon: "trendUpAlt", color: "#F9A8D4", label: "Matches your weak topic" };
      case "dept": return { icon: "trendUp", color: "#FFC55C", label: "Popular with your department" };
      case "uni": return { icon: "trendUp", color: "#6EE7A0", label: "Trending in your university" };
      default: return { icon: "trendUp", color: "#6EE7A0", label: "Trending on Scholars Circle" };
    }
  };

  return (
    <div className="hm-root" style={{ minHeight: "100vh" }}>
      <div className="hm-inner" style={{ paddingBottom: 28 }}>
        {/* ── Header + gamebar ── */}
        <div className="hm-topbar">
          <div className="hm-head" style={{ flex: 1, minWidth: 0 }}>
            <div className="hm-greet">
              <small>{greeting} {displayName}</small>
            </div>
            <div className="hm-head-right">
              <NotificationBellImproved token={token} currentUser={authUser} onOpenTab={onOpenTab} />
            </div>
          </div>
          <GameBar
            streak={streak}
            save={save}
            firstRun={firstRun}
            onOpenShop={() => { refreshSave(); setOpenSheet("shop"); }}
            onOpenBoard={() => setOpenSheet("board")}
            onOpenStats={() => setOpenSheet("stats")}
            onOpenGoal={() => setOpenSheet("goal")}
          />
        </div>

        <div className="hm-content">
          {/* ── Hero ── */}
          <div className="hm-sec-hero" style={{ marginTop: 14 }}>
            <HomeHero
              firstRun={firstRun}
              fsrsStats={fsrsStats}
              sm2DueCount={sm2DueCount}
              onStartDaily={() => setShowDailyReview(true)}
              onReviewQuestions={handleReviewQuestions}
              onReviewReadings={handleReviewReadings}
              onAddFirst={() => window.dispatchEvent(new CustomEvent("sc-open-research-hub", { detail: { openUpload: true } }))}
              onTrySample={() => openResearchHub("community")}
            />
          </div>

          {/* ── Virtual patient banner ── */}
          <button className="hm-vp hm-sec-vp" onClick={() => onOpenTab?.("clinical-cases")}>
            <div className="hm-vp-ic"><HIcon name="stetho" size={18} /></div>
            <div className="hm-vp-t">
              <h3>Virtual Patient · Dr. Amara</h3>
              <p>New case available — chest pain, 34y/o</p>
            </div>
            <div className="hm-vp-side">
              <span className="hm-vp-go">Start <HIcon name="arrowR" size={12} /></span>
              <span className="hm-vp-xp">+40 XP</span>
            </div>
          </button>

          {/* ── Jump back in ── */}
          {recents.length > 0 && (
            <div className="hm-section hm-sec-jump">
              <div className="hm-sec-head">
                <h2><HIcon name="clock" size={15} color="#9DB8E8" />Jump back in</h2>
                <button onClick={() => openResearchHub("library")}>History →</button>
              </div>
              <div className="hm-rail">
                {recents.slice(0, 6).map((d) => {
                  const prog = getPdfReadingProgress(d.fileUrl);
                  return (
                    <div key={d.shareToken} className="hm-doc" onClick={() => onOpenResource?.(d.shareToken)}>
                      <span className="hm-badge">{d.subject || "Document"}</span>
                      <h3>{d.title}</h3>
                      <div className="hm-sub">{relTime(d.ts)}</div>
                      {prog && <div className="hm-bar"><i style={{ width: `${prog.pct}%` }} /></div>}
                      <div className="hm-meta">
                        <span>{prog ? `Page ${prog.lastPage} of ${prog.numPages}` : "Not started"}</span>
                        <span>{prog ? `${prog.pct}%` : ""}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── For you (hidden entirely when no community folders) ── */}
          {foldersLoaded && forYouFolders.length > 0 && (
          <div className="hm-section hm-sec-foryou">
            <div className="hm-sec-head">
              <h2>For you</h2>
              <button onClick={() => openResearchHub("department")}>View all →</button>
            </div>
            <div className="hm-insight">
              <HIcon name="spark" size={13} />{insightText}
            </div>
              <div className="hm-rail">
                {forYouFolders.map((f) => {
                  const tint = tileTintStyle(f.name);
                  const r = reasonTag(f);
                  const saved = savedFolderIds.has(f.id);
                  return (
                    <div key={f.id} className="hm-folder" style={{ "--hm-accent": tint.color }} onClick={() => handleOpenFolder(f)}>
                      <div className="hm-f-head">
                        <div className="hm-f-ic" style={tint}><HIcon name="folder" size={15} /></div>
                        <div className="hm-f-name">
                          <h3>{f.name}</h3>
                          <span>{f.courseCode || (f.folderDepts?.[0]?.department?.name) || "Shared folder"}</span>
                        </div>
                        <span className="hm-f-count">{f._count?.resources || 0}</span>
                      </div>
                      <div className="hm-f-line">
                        {f.owner?.username ? `@${f.owner.username}` : "Community"}
                        {f.university?.name ? ` · ${f.university.name}` : ""}
                      </div>
                      <div className="hm-f-reason" style={{ color: r.color }}>
                        <HIcon name={r.icon} size={11} />{r.label}
                        <button
                          className={`hm-f-save${saved ? " saved" : ""}`}
                          onClick={(e) => handleSaveFolder(e, f)}
                          title={saved ? "Saved" : "Save to My Space"}
                        >
                          <HIcon name={saved ? "bookmarkFill" : "bookmark"} size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
          </div>
          )}

          {/* ── Your library ── */}
          <div className="hm-section hm-sec-library">
            <div className="hm-sec-head"><h2>Your library</h2></div>
            <div className="hm-lib">
              <button className="hm-lib-card" onClick={() => openResearchHub("community")}>
                <div className="hm-lib-ic blue"><HIcon name="users" size={16} /></div>
                <h3>Community</h3>
                <p>{communityFolders.length} shared folders</p>
              </button>
              <button className="hm-lib-card" onClick={() => openResearchHub("space", "saved")}>
                <div className="hm-lib-ic amber"><HIcon name="folder" size={16} /></div>
                <h3>My Space</h3>
                <p>{resourceCounts.saved} saved · {resourceCounts.uploads} uploads</p>
              </button>
            </div>
          </div>

          {/* ── Study circle ── */}
          <div className="hm-section hm-sec-circle">
            <div className="hm-sec-head"><h2>Your study circle</h2></div>
            <div className="hm-board">
              {leaderboard.length > 0 ? (
                <>
                  <div className="hm-stack">
                    {[...leaderboard]
                      .sort((a, b) => (b.totalXP || b.xp || 0) - (a.totalXP || a.xp || 0))
                      .slice(0, 4)
                      .map((e, i) => (
                        <div key={e.userId || i} className="hm-p" style={{ background: avColor(e.username) }}>
                          {initials(e.username)}
                        </div>
                      ))}
                  </div>
                  <h4>{leaderboard.length} scholar{leaderboard.length === 1 ? "" : "s"} on the board</h4>
                  <p>Keep your streak alive to climb the all-time ranks.</p>
                </>
              ) : (
                <>
                  <div className="hm-stack" />
                  <h4>No leaderboard data yet</h4>
                  <p>Invite friends and race on all-time XP.</p>
                </>
              )}
              <button className="hm-invite" onClick={() => setOpenSheet("board")}>
                <HIcon name="trophy" size={13} />View leaderboard
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Sheets ── */}
      <ShopSheet open={openSheet === "shop"} onClose={() => setOpenSheet(null)} save={save} onBuyFreeze={handleBuyFreeze} />
      <BoardSheet open={openSheet === "board"} onClose={() => setOpenSheet(null)} entries={leaderboard} userName={userName || authUser?.username} onInvite={handleInvite} />
      <StatsSheet
        open={openSheet === "stats"} onClose={() => setOpenSheet(null)}
        fsrsStats={fsrsStats} fsrsAnalytics={fsrsAnalytics}
        onOpenFull={() => { setOpenSheet(null); onOpenTab?.("progress"); }}
      />
      <GoalSheet open={openSheet === "goal"} onClose={() => setOpenSheet(null)} dailyGoal={fsrsStats?.dailyGoal || 20} onSelect={handleSetGoal} />

      {toast && <div className="hm-toast">{toast}</div>}

      {/* ── Daily Review overlay ── */}
      {showDailyReview && (
        <div className="fixed inset-0 z-[9999] flex flex-col bg-hub-bg">
          <DailyReview
            onBack={() => { setShowDailyReview(false); fetchFsrsStats(); refreshSave(); }}
            onComplete={() => { fetchFsrsStats(); refreshSave(); }}
          />
        </div>
      )}

      {/* ── Questions-only practice runner ── */}
      {mcqPracticeItems && (
        <StreakSurvival
          items={mcqPracticeItems}
          mode="practice"
          onBack={() => { setMcqPracticeItems(null); fetchFsrsStats(); refreshSave(); }}
        />
      )}
    </div>
  );
}
