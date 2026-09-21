import { useState, useEffect, useCallback, useMemo, Fragment } from "react";
import { getMyProfile } from "../lib/profileApi.js";
import NotificationBellImproved from "../features/NotificationBellImproved";
import DailyReview from "../features/research-hub/DailyReview.jsx";
import { listCommunityFolders, bookmarkFolder } from "../lib/foldersApi.js";
import { loadSave, mutate, tickDay, activeQuests, claimQuest, levelFromXP, syncTotalXp } from "../features/streak-survival/survivalStore.js";
import { listRecentDocs, weakestSubject } from "../lib/homeUtils.js";
import { getGuidedProgressIndex } from "../lib/studyCache.js";
import { extractResourceText } from "../features/research-hub/useMaterialGenerate.js";
import { CASES } from "../features/clinicalCases/caseData.js";
import { getPdfReadingProgress, tileTintStyle } from "../lib/researchUtils.js";
import GameBar from "./home/GameBar.jsx";
import HomeHero from "./home/HomeHero.jsx";
import WelcomeSheet from "./home/WelcomeSheet.jsx";
import { ShopSheet, BoardSheet, StatsSheet, GoalSheet } from "./home/HomeSheets.jsx";
import HIcon from "./home/HIcon.jsx";
import { useDailyWelcome } from "../hooks/useDailyWelcome.js";
import { API_BASE } from "../lib/constants";
import "../home.css";

const FREEZE_COST = 15; // matches the Streak Survival in-game shop price

function getAuthHeaders() {
  try {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { "Content-Type": "application/json", Authorization: `Bearer ${authData.authToken}` };
  } catch {
    return { "Content-Type": "application/json" };
  }
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
  onStartSubject, onOpenTab, onOpenLeaderboard,
  onOpenAI, onOpenLearn, onOpenStudy, onOpenResource, token, authUser,
}) {
  const [fsrsStats, setFsrsStats] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sc_fsrs_stats") || "null")?.data ?? null; } catch { return null; }
  });
  const [showDailyReview, setShowDailyReview] = useState(false);
  const [save, setSave] = useState(() => ({ ...loadSave() }));
  const [openSheet, setOpenSheet] = useState(null); // 'shop' | 'board' | 'stats' | 'goal'
  const [toast, setToast] = useState(null);
  const [recents, setRecents] = useState(() => listRecentDocs());
  const [guidedProg, setGuidedProg] = useState({});
  const [preparingGuided, setPreparingGuided] = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const refreshSave = useCallback(() => setSave({ ...loadSave() }), []);

  const fetchFsrsStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFsrsStats(data);
        try { localStorage.setItem("sc_fsrs_stats", JSON.stringify({ data, ts: Date.now() })); } catch {}
        // Server owns freeze inventory — keep the local save in sync
        if (typeof data.freezes === "number") {
          mutate((s) => { s.freezes = data.freezes; });
          setSave({ ...loadSave() });
        }
      }
    } catch {}
  }, []);

  useEffect(() => { fetchFsrsStats(); }, [fetchFsrsStats]);

  // Day-rollover for quests (resets progress at local midnight)
  useEffect(() => { tickDay(); setSave({ ...loadSave() }); }, []);

  // Keep the local survival XP mirror aligned with the unified app/server total
  useEffect(() => { syncTotalXp(stats?.xp); setSave({ ...loadSave() }); }, [stats?.xp]);

  useEffect(() => {
    let live = true;
    const loadGuided = () => getGuidedProgressIndex().then((idx) => { if (live) setGuidedProg(idx || {}); }).catch(() => {});
    loadGuided();
    const onRated = () => { try { localStorage.removeItem("sc_fsrs_stats"); } catch {} fetchFsrsStats(); };
    const onRecent = () => { setRecents(listRecentDocs()); loadGuided(); };
    window.addEventListener("sc-fsrs-rated", onRated);
    window.addEventListener("sc-recent-doc", onRecent);
    window.addEventListener("sc-guided-progress", loadGuided);
    return () => {
      live = false;
      window.removeEventListener("sc-fsrs-rated", onRated);
      window.removeEventListener("sc-recent-doc", onRecent);
      window.removeEventListener("sc-guided-progress", loadGuided);
    };
  }, [fetchFsrsStats]);

  // Retention analytics for the stats sheet (7/30-day ranges, fetched on demand)
  const fetchAnalytics = useCallback(async (days = 7) => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/analytics?days=${days}`, { headers: getAuthHeaders() });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }, []);

  // Resume a Guided Study session on a recent doc at the stopped section —
  // re-extracting the text reproduces the same docCacheKey, so the cached
  // roadmap (with studied progress) is picked up automatically.
  const resumeGuided = useCallback(async (d) => {
    if (!d?.resourceId || preparingGuided) return;
    setPreparingGuided(d.shareToken);
    try {
      const { text } = await extractResourceText({
        contentType: d.contentType, fileUrl: d.fileUrl, fileName: d.title, title: d.title,
      });
      const content = (text || "").trim();
      if (!content) { showToast("Couldn't extract text from this file"); return; }
      window.dispatchEvent(new CustomEvent("sc-open-study", {
        detail: {
          topic: d.title,
          mode: "auto-roadmap",
          attachment: { name: d.title, content },
          context: { resourceId: d.resourceId, matches: [{ title: d.title, contentType: d.contentType }] },
        },
      }));
    } catch {
      showToast("Couldn't resume guided study");
    } finally {
      setPreparingGuided(null);
    }
  }, [preparingGuided, showToast]);

  const [resourceCounts, setResourceCounts] = useState({ dept: 0, saved: 0, uploads: 0 });
  const [communityFolders, setCommunityFolders] = useState([]);
  const [foldersLoaded, setFoldersLoaded] = useState(false);
  const [savedFolderIds, setSavedFolderIds] = useState(new Set());
  const [leaderboard, setLeaderboard] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [mcqProgress, setMcqProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem("sc_mcq_progress") || "null")?.data || {}; } catch { return {}; }
  });

  const fetchBoard = useCallback(async () => {
    try {
      const lbRes = await fetch(`${API_BASE}/users/leaderboard`, { headers: getAuthHeaders() });
      if (lbRes.ok) {
        const data = await lbRes.json();
        const entries = data.entries || data;
        setLeaderboard(Array.isArray(entries) ? entries : []);
      }
    } catch {}
  }, []);

  useEffect(() => { fetchBoard(); }, [fetchBoard]);
  useEffect(() => { if (openSheet === "board") fetchBoard(); }, [openSheet, fetchBoard]);

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
      try {
        const mpRes = await fetch(`${API_BASE}/api/resources/my-mcq-progress`, { headers });
        if (mpRes.ok) {
          const mp = await mpRes.json();
          if (!cancelled) setMcqProgress(mp);
          try { localStorage.setItem("sc_mcq_progress", JSON.stringify({ data: mp, ts: Date.now() })); } catch {}
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
    }
    fetchHubData();
    return () => { cancelled = true; };
  }, [token]);

  const sm2DueCount = dueCards?.length || 0;
  const firstRun = fsrsStats != null && (fsrsStats.totalItems || 0) === 0;
  const weakest = useMemo(() => weakestSubject(fsrsStats), [fsrsStats]);

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

  const handleBuyFreeze = useCallback(async () => {
    if ((save.gems || 0) < FREEZE_COST) { showToast("Not enough gems"); return; }
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/freeze`, {
        method: "POST", headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      mutate((s) => { s.gems -= FREEZE_COST; s.freezes = data.freezes; });
      refreshSave();
      showToast("Streak Freeze added");
    } catch {
      showToast("Couldn't buy freeze — check your connection");
    }
  }, [save.gems, refreshSave, showToast]);

  const handleClaimQuest = useCallback((id) => {
    const reward = claimQuest(id);
    if (reward > 0) { refreshSave(); showToast(`+${reward} gems — quest complete`); }
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

  // Rotate a real VP case daily instead of fabricated banner text
  const vpCase = useMemo(() => {
    const now = new Date();
    const day = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
    return CASES.length ? CASES[day % CASES.length] : null;
  }, []);

  const quests = useMemo(() => activeQuests(), [save]);
  const myRank = useMemo(() => {
    const ranked = [...leaderboard].sort((a, b) => (b.totalXP || b.xp || 0) - (a.totalXP || a.xp || 0));
    const me = userName || authUser?.username;
    const idx = ranked.findIndex((e) => e.username === me);
    return { ranked, idx };
  }, [leaderboard, userName, authUser]);

  const displayName = userName || authUser?.username || authUser?.name || "Scholar";
  const streak = stats?.streak || fsrsStats?.streak || 0;
  const questsDone = quests.filter((q) => (save.questProgress?.[q.id] || 0) >= q.target).length;

  // ── Daily welcome popup data ──
  const level = levelFromXP(save.xp || 0);
  // null until fsrsStats resolves — never claim "0 items due" before data loads
  const dueCount = fsrsStats ? (fsrsStats.dueCount || 0) + sm2DueCount : null;
  const lastActiveDaysAgo = useMemo(() => {
    let last = null;
    try {
      const uid = authUser?.id || authUser?.username || "guest";
      const raw = localStorage.getItem(`scholars-circle-state::${uid}`);
      const iso = raw ? JSON.parse(raw)?.lastStudied : null;
      if (iso) {
        const t = new Date(`${iso}T00:00:00`).getTime();
        if (!Number.isNaN(t)) last = t;
      }
    } catch {}
    for (const h of history || []) {
      const t = h?.ts ? new Date(h.ts).getTime() : null;
      if (t && !Number.isNaN(t) && (last == null || t > last)) last = t;
    }
    if (last == null) return null;
    return Math.max(0, Math.round((Date.now() - last) / 86400000));
  }, [authUser, history]);

  const { message: welcome, dismiss: dismissWelcome } = useDailyWelcome({
    userId: authUser?.id || authUser?.username,
    dataReady: fsrsStats != null,
    streak,
    level,
    dueCount,
    name: displayName,
    lastActiveDaysAgo,
  });


  const reasonTag = (f) => {
    switch (f._reason) {
      case "weak": return { icon: "trendUpAlt", color: "#F9A8D4", label: "Matches your weak topic" };
      case "dept": return { icon: "trendUp", color: "#FFC55C", label: "Popular with your department" };
      case "uni": return { icon: "trendUp", color: "#6EE7A0", label: "Trending in your university" };
      default: return { icon: "trendUp", color: "#6EE7A0", label: "Trending on Scholars Circle" };
    }
  };

  return (
    <div className="hm-root" style={{ minHeight: "100dvh" }}>
      <div className="hm-inner" style={{ paddingBottom: 28 }}>
        {/* ── Compact top bar ── */}
        <div className="hm-topbar">
          <GameBar
            streak={streak}
            save={save}
            firstRun={firstRun}
            onOpenShop={() => { refreshSave(); setOpenSheet("shop"); }}
            onOpenBoard={() => setOpenSheet("board")}
            onOpenStats={() => setOpenSheet("stats")}
            onOpenGoal={() => setOpenSheet("goal")}
            bell={<NotificationBellImproved token={token} currentUser={authUser} onOpenTab={onOpenTab} />}
          />
        </div>

        <div className="hm-content">
          {/* ── Hero ── */}
          <div className="hm-sec-hero">
            <HomeHero
              firstRun={firstRun}
              fsrsStats={fsrsStats}
              sm2DueCount={sm2DueCount}
              onStartDaily={() => setShowDailyReview(true)}
              onAddFirst={() => window.dispatchEvent(new CustomEvent("sc-open-research-hub", { detail: { openUpload: true } }))}
              onTrySample={() => openResearchHub("community")}
            />
          </div>

          {/* ── Jump back in ── */}
          {recents.length > 0 && (
            <div className="hm-section hm-sec-jump">
              <div className="hm-sec-head">
                <h2><HIcon name="clock" size={15} color="#9DB8E8" />Jump back in <span className="hm-count">{Math.min(recents.length, 6)}</span></h2>
                <button onClick={() => openResearchHub("library")}>History →</button>
              </div>
              <div className="hm-rail">
                {recents.slice(0, 6).map((d) => {
                  const isMcq = d.contentType === "mcq";
                  const mp = isMcq && d.resourceId ? mcqProgress[d.resourceId] : null;
                  const prog = !isMcq ? getPdfReadingProgress(d.fileUrl) : null;
                  const pct = isMcq ? (mp?.learnedPct ?? null) : (prog?.pct ?? null);
                  const gp = d.resourceId ? guidedProg[d.resourceId] : null;
                  const guideActive = !isMcq && gp && gp.total > 0 && gp.done < gp.total;
                  const left = isMcq
                    ? (mp ? `${mp.mastered || 0}/${mp.total || "?"} mastered · best ${mp.bestScore}/${mp.bestTotal}` : relTime(d.ts))
                    : (prog ? `Page ${prog.lastPage} of ${prog.numPages}` : `Opened ${relTime(d.ts)}`);
                  const gpPct = guideActive ? Math.round((gp.done / gp.total) * 100) : 0;
                  return (
                    <Fragment key={d.shareToken}>
                      <div className="hm-doc" onClick={() => onOpenResource?.(d.shareToken, prog?.lastPage)}>
                        <span className="hm-badge">{isMcq ? "MCQ" : d.subject || "Document"}</span>
                        <h3>{d.title}</h3>
                        <div className="hm-sub">{isMcq ? relTime(d.ts) : d.subject || relTime(d.ts)}</div>
                        {pct != null && <div className="hm-bar"><i style={{ width: `${pct}%` }} /></div>}
                        <div className="hm-meta">
                          <span>{left}</span>
                          <span>{pct != null ? `${pct}%` : ""}</span>
                        </div>
                      </div>
                      {guideActive && (
                        <button
                          className="hm-doc hm-doc-guided"
                          onClick={() => resumeGuided(d)}
                          disabled={preparingGuided === d.shareToken}
                        >
                          <span className="hm-badge">Guided study</span>
                          <h3>{gp.title || d.title}</h3>
                          <div className="hm-sub">Section {gp.done + 1} of {gp.total}</div>
                          <div className="hm-bar"><i style={{ width: `${gpPct}%` }} /></div>
                          <div className="hm-meta">
                            <span>{preparingGuided === d.shareToken ? "Preparing…" : "Continue"}</span>
                            <span className="hm-doc-go">{gpPct}% →</span>
                          </div>
                        </button>
                      )}
                    </Fragment>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Virtual patient banner (real case, rotates daily) ── */}
          {vpCase && (
          <button className="hm-vp hm-sec-vp" onClick={() => onOpenTab?.("clinical-cases")}>
            <div className="hm-vp-ic"><HIcon name="stetho" size={18} /></div>
            <div className="hm-vp-t">
              <h3>Virtual Patient · {vpCase.specialty}</h3>
              <p>{vpCase.demo} — “{vpCase.cc}”</p>
            </div>
            <div className="hm-vp-side">
              <span className="hm-vp-go">Start <HIcon name="arrowR" size={12} /></span>
              <span className="hm-vp-xp">{vpCase.bed}</span>
            </div>
          </button>
          )}

          {/* ── Today's quests ── */}
          <div className="hm-section hm-sec-quests">
            <div className="hm-sec-head"><h2><HIcon name="target" size={15} color="#C0B2FF" />Today's quests <span className="hm-count">{questsDone}/{quests.length}</span></h2></div>
            <div className="hm-quests">
              {quests.map((q) => {
                const prog = save.questProgress?.[q.id] || 0;
                const claimed = (save.questClaimed || []).includes(q.id);
                const done = prog >= q.target;
                return (
                  <button
                    key={q.id}
                    className={`hm-quest${done && !claimed ? " ready" : ""}${claimed ? " claimed" : ""}`}
                    onClick={() => done && !claimed && handleClaimQuest(q.id)}
                    disabled={!done || claimed}
                  >
                    <span className="hm-q-ico">{q.ico}</span>
                    <span className="hm-q-info">
                      <span className="hm-q-name">{q.name}</span>
                      <span className="hm-q-bar"><i style={{ width: `${Math.min(100, (prog / q.target) * 100)}%` }} /></span>
                      <span className="hm-q-meta">{Math.min(prog, q.target)}/{q.target} · <HIcon name="gem" size={9} color="#6EC1FF" />{q.reward}</span>
                    </span>
                    {claimed
                      ? <HIcon name="check" size={14} color="#6EE7A0" />
                      : done ? <span className="hm-q-claim">Claim</span> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── For you (hidden entirely when no community folders) ── */}
          {foldersLoaded && forYouFolders.length > 0 && (
          <div className="hm-section hm-sec-foryou">
            <div className="hm-sec-head">
              <h2>For you <span className="hm-count">{forYouFolders.length}</span></h2>
              <button onClick={() => openResearchHub("community")}>View all →</button>
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
                        <span className="hm-f-count">{f._count?.resources || 0} files</span>
                      </div>
                      <div className="hm-f-line">
                        <span className="hm-f-comm"><HIcon name="users" size={9} />Community</span>
                        {f.owner?.username ? `@${f.owner.username}` : "Shared folder"}
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
            <div className="hm-sec-head"><h2>Your study circle {leaderboard.length > 0 && <span className="hm-count">{leaderboard.length}</span>}</h2></div>
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
      <BoardSheet open={openSheet === "board"} onClose={() => setOpenSheet(null)} entries={leaderboard} userName={userName || authUser?.username} myIdx={myRank.idx} onInvite={handleInvite} onViewAll={() => onOpenLeaderboard?.()} />
      <StatsSheet
        open={openSheet === "stats"} onClose={() => setOpenSheet(null)}
        fsrsStats={fsrsStats} save={save} fetchAnalytics={fetchAnalytics}
      />
      <GoalSheet open={openSheet === "goal"} onClose={() => setOpenSheet(null)} dailyGoal={fsrsStats?.dailyGoal || 20} onSelect={handleSetGoal} />

      {/* ── Daily welcome popup (once per day per user) ── */}
      <WelcomeSheet
        message={welcome}
        onClose={dismissWelcome}
        onStartDaily={() => setShowDailyReview(true)}
      />

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
    </div>
  );
}
