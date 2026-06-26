import React, { memo } from "react";
import LearnHub from "../features/LearnHub";
import { CardSkeleton, ListSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";

function Learn({
  subjects: subjectsProp,
  mastery: masteryProp,
  srData: srDataProp,
  wrongCounts: wrongCountsProp,
  history: historyProp,
  customFlashcards: customFlashcardsProp,
  setCustomFlashcards,
  outlineProgress: outlineProgressProp,
  setOutlineProgress,
  demoMode: demoModeProp,
  DEMO_LIMITS,
  token: tokenProp,
  completeSession,
  startSubjectPractice,
  startAdaptive,
  startSpacedReview,
  startWeakDrill,
  startErrorDrill,
  setActiveSession,
  toast,
  dueCards,
  aiConfig: aiConfigProp,
  setMastery,
  setWrongCounts,
  activeDept,
  activeYearLevel,
  onOpenDeptSwitcher,
  loading,
}) {
  const { token: ctxToken } = useAuth();
  const { subjects: ctxSubjects, mastery: ctxMastery, srData: ctxSrData, wrongCounts: ctxWrongCounts, history: ctxHistory, customFlashcards: ctxCustomFlashcards, outlineProgress: ctxOutlineProgress } = useUserData();
  const { aiConfig: ctxAiConfig, demoMode: ctxDemoMode } = useUI();

  const subjects = subjectsProp ?? ctxSubjects ?? [];
  const mastery = masteryProp ?? ctxMastery ?? {};
  const srData = srDataProp ?? ctxSrData ?? {};
  const wrongCounts = wrongCountsProp ?? ctxWrongCounts ?? {};
  const history = historyProp ?? ctxHistory ?? [];
  const customFlashcards = customFlashcardsProp ?? ctxCustomFlashcards ?? [];
  const outlineProgress = outlineProgressProp ?? ctxOutlineProgress ?? {};
  const demoMode = demoModeProp ?? ctxDemoMode ?? false;
  const token = tokenProp ?? ctxToken;
  const aiConfig = aiConfigProp ?? ctxAiConfig;
  if (loading) {
    return (
      <>
        <CardSkeleton />
        <div style={{ height: 16 }} />
        <ListSkeleton count={4} />
      </>
    );
  }
  return (
    <LearnHub
      subjects={subjects}
      mastery={mastery}
      srData={srData}
      wrongCounts={wrongCounts}
      history={history}
      customFlashcards={customFlashcards}
      setCustomFlashcards={setCustomFlashcards}
      outlineProgress={outlineProgress}
      setOutlineProgress={setOutlineProgress}
      demoMode={demoMode}
      DEMO_LIMITS={DEMO_LIMITS}
      token={token}
      completeSession={completeSession}
      startSubjectPractice={startSubjectPractice}
      startAdaptive={startAdaptive}
      startSpacedReview={startSpacedReview}
      startWeakDrill={startWeakDrill}
      startErrorDrill={startErrorDrill}
      setActiveSession={setActiveSession}
      toast={toast}
      dueCards={dueCards}
      aiConfig={aiConfig}
      setMastery={setMastery}
      setWrongCounts={setWrongCounts}
      activeDept={activeDept}
      activeYearLevel={activeYearLevel}
      onOpenDeptSwitcher={onOpenDeptSwitcher}
    />
  );
}

export default memo(Learn);
