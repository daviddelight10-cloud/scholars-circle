import React, { memo, Suspense } from "react";
import { lazyWithRetry } from "../lib/lazyWithRetry.js";
import { Leaderboard } from "../components/Leaderboard";
import { AchievementsBadges } from "../components/SearchAndBadges";
import { BADGES } from "../lib/constants";
import { StatsGridSkeleton, CardSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";

const GamificationHub = lazyWithRetry(() => import("../features/Gamification"));

function Progress({
  authUser: authUserProp,
  stats: statsProp,
  history: historyProp,
  subjects: subjectsProp,
  token: tokenProp,
  progressSubTab: progressSubTabProp,
  setProgressSubTab: setProgressSubTabProp,
  loading,
}) {
  const { user: ctxUser, token: ctxToken } = useAuth();
  const { stats: ctxStats, history: ctxHistory, subjects: ctxSubjects } = useUserData();
  const { progressSubTab: ctxProgressSubTab, setProgressSubTab: ctxSetProgressSubTab } = useUI();

  const authUser = authUserProp ?? ctxUser;
  const stats = statsProp ?? ctxStats ?? {};
  const history = historyProp ?? ctxHistory ?? [];
  const subjects = subjectsProp ?? ctxSubjects ?? [];
  const token = tokenProp ?? ctxToken;
  const progressSubTab = progressSubTabProp ?? ctxProgressSubTab ?? "leaderboard";
  const setProgressSubTab = setProgressSubTabProp ?? ctxSetProgressSubTab;
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
    <>
      {/* Progress Hub sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "leaderboard", label: "🏆 Leaderboard" },
          { id: "badges", label: "🏅 Badges" },
          { id: "arena", label: "⚔️ Arena" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setProgressSubTab(id)}
            style={{
              padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: progressSubTab === id ? "2px solid #FFD700" : "1px solid rgba(255,215,0,0.25)",
              background: progressSubTab === id ? "linear-gradient(135deg,#FFD700,#DAA520)" : "rgba(20,20,20,0.6)",
              color: progressSubTab === id ? "#fff" : "#FFD700",
            }}
          >{label}</button>
        ))}
      </div>

      {progressSubTab === "leaderboard" && (
        <Leaderboard token={token} />
      )}

      {progressSubTab === "badges" && (
        <AchievementsBadges
          badges={BADGES}
          stats={stats}
          history={history}
          subjects={subjects}
        />
      )}

      {progressSubTab === "arena" && (
        <Suspense fallback={<div className="card"><p className="muted">Loading arena...</p></div>}>
          <GamificationHub
            token={token}
            userId={authUser?.id}
            username={authUser?.username}
            classroomId={null}
            leaderboard={[]}
          />
        </Suspense>
      )}
    </>
  );
}

export default memo(Progress);
