import React, { memo } from "react";
import AISectionOverlay from "../features/AISectionOverlay.jsx";
import { CardSkeleton } from "../components/LoadingSkeleton";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";

function AITutor({
  aiKey,
  aiDefaultView,
  aiStudyTopic,
  aiStudyMode,
  aiStudyAttachment,
  aiConfig: aiConfigProp,
  subjects: subjectsProp,
  onExit,
  loading,
}) {
  const { aiConfig: ctxAiConfig } = useUI();
  const { subjects: ctxSubjects } = useUserData();

  const aiConfig = aiConfigProp ?? ctxAiConfig;
  const subjects = subjectsProp ?? ctxSubjects ?? [];
  if (loading) {
    return <CardSkeleton />;
  }
  return (
    <AISectionOverlay
      key={aiKey}
      defaultView={aiDefaultView}
      studyTopic={aiStudyTopic}
      studyMode={aiStudyMode}
      studyAttachment={aiStudyAttachment}
      aiConfig={aiConfig}
      subjects={subjects}
      onExit={onExit}
    />
  );
}

export default memo(AITutor);
