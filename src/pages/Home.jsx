import React, { memo } from "react";
import Dashboard from "../components/Dashboard";
import { CardSkeleton, StatsGridSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";

function Home({
  authUser: authUserProp,
  subjects: subjectsProp,
  mastery: masteryProp,
  dueCards,
  history: historyProp,
  stats: statsProp,
  aiConfig: aiConfigProp,
  onStartSpaced,
  onStartSubject,
  onOpenTab,
  onOpenLeaderboard,
  onOpenAI,
  onOpenLearn,
  onOpenStudy,
  onOpenResource,
  onImportToBank,
  loading,
  token,
}) {
  const { user: ctxUser } = useAuth();
  const { stats: ctxStats, history: ctxHistory, subjects: ctxSubjects, mastery: ctxMastery } = useUserData();
  const { aiConfig: ctxAiConfig } = useUI();

  const authUser = authUserProp ?? ctxUser;
  const subjects = subjectsProp ?? ctxSubjects ?? [];
  const mastery = masteryProp ?? ctxMastery ?? {};
  const history = historyProp ?? ctxHistory ?? [];
  const stats = statsProp ?? ctxStats ?? {};
  const aiConfig = aiConfigProp ?? ctxAiConfig;
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
    <Dashboard
      userName={authUser?.username || authUser?.name || "Scholar"}
      onOpenAI={onOpenAI}
      onOpenLearn={onOpenLearn}
      onOpenStudy={onOpenStudy}
      subjects={subjects}
      mastery={mastery}
      dueCards={dueCards}
      history={history}
      stats={stats}
      onStartSpaced={onStartSpaced}
      onStartSubject={onStartSubject}
      onOpenTab={onOpenTab}
      onOpenLeaderboard={onOpenLeaderboard}
      onOpenResource={onOpenResource}
      token={token}
      authUser={authUser}
    />
  );
}

export default memo(Home);
