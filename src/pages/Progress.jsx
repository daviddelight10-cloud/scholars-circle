import React, { memo, Suspense, useEffect, useState } from "react";
import { lazyWithRetry } from "../lib/lazyWithRetry.js";
import { Leaderboard } from "../components/Leaderboard";
import { StatsGridSkeleton, CardSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";
import { haptics } from "../lib/haptics";

const StatsDashboard = lazyWithRetry(() => import("../components/analytics/StatsDashboard"));

const SUB_TABS = [
  { id: "leaderboard", label: "🏆 Leaderboard", short: "Leaderboard" },
  { id: "stats", label: "📊 Stats", short: "Stats" },
];

function Progress({
  stats: statsProp,
  history: historyProp,
  subjects: subjectsProp,
  token: tokenProp,
  progressSubTab: progressSubTabProp,
  setProgressSubTab: setProgressSubTabProp,
  loading,
}) {
  const { token: ctxToken } = useAuth();
  const { stats: ctxStats, history: ctxHistory, subjects: ctxSubjects } = useUserData();
  const { progressSubTab: ctxProgressSubTab, setProgressSubTab: ctxSetProgressSubTab } = useUI();

  const stats = statsProp ?? ctxStats ?? {};
  const history = historyProp ?? ctxHistory ?? [];
  const subjects = subjectsProp ?? ctxSubjects ?? [];
  const token = tokenProp ?? ctxToken;
  const progressSubTabProp_ = progressSubTabProp ?? ctxProgressSubTab ?? "leaderboard";
  const setProgressSubTab = setProgressSubTabProp ?? ctxSetProgressSubTab;
  // Guard against stale sub-tab values (e.g. removed "badges"/"arena") persisted in UI context
  const progressSubTab = SUB_TABS.some((t) => t.id === progressSubTabProp_) ? progressSubTabProp_ : "leaderboard";

  // App-feel chrome: large title collapses into the sticky sub-tab bar on scroll
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = (e) => {
      const y = e.target === document
        ? (document.documentElement.scrollTop || document.body.scrollTop)
        : e.target.scrollTop;
      setScrolled(y > 24);
    };
    // capture: true catches inner scroll containers too, not just window
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  if (loading) {
    return (
      <>
        <StatsGridSkeleton count={4} />
        <div style={{ height: 16 }} />
        <CardSkeleton />
      </>
    );
  }
  return (
    <div className={`pg-root${scrolled ? " scrolled" : ""}`}>
      <div className="pg-head">
        {/* iOS-style large title — collapses into the sticky sub-tab bar */}
        <div className={`pg-title${scrolled ? " gone" : ""}`}>
          <span className="pg-title-txt">Progress</span>
          <span className="pg-title-sub">{SUB_TABS.find((t) => t.id === progressSubTab)?.short}</span>
        </div>
        <div className="pg-seg">
          {SUB_TABS.map(({ id, label }) => (
            <button
              key={id}
              className={`pg-tab${progressSubTab === id ? " active" : ""}`}
              onClick={() => { haptics.selection(); setProgressSubTab(id); }}
            >{label}</button>
          ))}
        </div>
      </div>

      {/* Keyed remount → the switch animates like a native page turn */}
      <div className="pg-content" key={progressSubTab}>
        {progressSubTab === "leaderboard" && (
          <Leaderboard token={token} />
        )}

        {progressSubTab === "stats" && (
          <Suspense fallback={<div className="card"><p className="muted">Loading stats...</p></div>}>
            <StatsDashboard
              stats={stats}
              history={history}
              subjects={subjects}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default memo(Progress);
