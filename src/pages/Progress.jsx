import React, { memo, Suspense, lazy } from "react";
import StatsPanel from "../features/StatsPanel";
import { Leaderboard } from "../components/Leaderboard";
import { AchievementsBadges } from "../components/SearchAndBadges";
import { BADGES } from "../lib/constants";
import { StatsGridSkeleton, CardSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";

const GamificationHub = lazy(() => import("../features/Gamification"));

function Progress({
  authUser: authUserProp,
  stats: statsProp,
  history: historyProp,
  subjects: subjectsProp,
  mastery: masteryProp,
  token: tokenProp,
  progressSubTab: progressSubTabProp,
  setProgressSubTab: setProgressSubTabProp,
  aiConfig: aiConfigProp,
  onRePractice,
  loading,
}) {
  const { user: ctxUser, token: ctxToken } = useAuth();
  const { stats: ctxStats, history: ctxHistory, subjects: ctxSubjects, mastery: ctxMastery } = useUserData();
  const { aiConfig: ctxAiConfig, progressSubTab: ctxProgressSubTab, setProgressSubTab: ctxSetProgressSubTab } = useUI();

  const authUser = authUserProp ?? ctxUser;
  const stats = statsProp ?? ctxStats ?? {};
  const history = historyProp ?? ctxHistory ?? [];
  const subjects = subjectsProp ?? ctxSubjects ?? [];
  const mastery = masteryProp ?? ctxMastery ?? {};
  const token = tokenProp ?? ctxToken;
  const aiConfig = aiConfigProp ?? ctxAiConfig;
  const progressSubTab = progressSubTabProp ?? ctxProgressSubTab ?? "stats";
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
          { id: "stats", label: "📊 Stats" },
          { id: "leaderboard", label: "🏆 Leaderboard" },
          { id: "badges", label: "🏅 Badges" },
          { id: "arena", label: "⚔️ Arena" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setProgressSubTab(id)}
            style={{
              padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: progressSubTab === id ? "2px solid #818cf8" : "1px solid rgba(99,102,241,0.25)",
              background: progressSubTab === id ? "linear-gradient(135deg,#6366f1,#8b5cf6)" : "rgba(30,41,59,0.6)",
              color: progressSubTab === id ? "#fff" : "#a5b4fc",
            }}
          >{label}</button>
        ))}
      </div>

      {progressSubTab === "leaderboard" && (
        <Leaderboard
          username={authUser?.username}
          xp={stats.xp}
          sessions={stats.sessions}
          streak={stats.streak}
          mastery={mastery}
          subjects={subjects}
          token={token}
        />
      )}

      {progressSubTab === "badges" && (
        <AchievementsBadges
          badges={BADGES}
          stats={stats}
          history={history}
          subjects={subjects}
          mastery={mastery}
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

      {progressSubTab === "stats" && (
        <div>
          <h2>📊 Analytics</h2>
          <StatsPanel
            history={history}
            stats={stats}
            subjects={subjects}
            mastery={mastery}
            aiConfig={aiConfig}
            onRePractice={onRePractice}
          />
        </div>
      )}
    </>
  );
}

export default memo(Progress);
