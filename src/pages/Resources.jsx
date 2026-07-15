import React, { memo } from "react";
import { NotesEditor, CheatSheet } from "../components/StudyTools";
import { FlashcardDeck } from "../components/FlashcardDeck";
import CourseOutline from "../features/CourseOutline";
import DemoLockedOverlay from "../components/DemoLockedOverlay";
import { DEMO_LIMITS } from "../lib/constants";
import { CardSkeleton, ListSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";

function Resources({
  subjects: subjectsProp,
  notes: notesProp,
  setNotes,
  srData: srDataProp,
  customFlashcards: customFlashcardsProp,
  setCustomFlashcards,
  token: tokenProp,
  mastery: masteryProp,
  demoMode: demoModeProp,
  resourcesSubTab: resourcesSubTabProp,
  setResourcesSubTab: setResourcesSubTabProp,
  outlineSubjectId,
  setOutlineSubjectId,
  outlineProgress: outlineProgressProp,
  setOutlineProgress,
  startSubjectPractice,
  toast,
  loading,
}) {
  const { token: ctxToken } = useAuth();
  const { subjects: ctxSubjects, notes: ctxNotes, srData: ctxSrData, customFlashcards: ctxCustomFlashcards, mastery: ctxMastery, outlineProgress: ctxOutlineProgress } = useUserData();
  const { demoMode: ctxDemoMode, resourcesSubTab: ctxResourcesSubTab, setResourcesSubTab: ctxSetResourcesSubTab } = useUI();

  const subjects = subjectsProp ?? ctxSubjects ?? [];
  const notes = notesProp ?? ctxNotes ?? {};
  const srData = srDataProp ?? ctxSrData ?? {};
  const customFlashcards = customFlashcardsProp ?? ctxCustomFlashcards ?? [];
  const token = tokenProp ?? ctxToken;
  const mastery = masteryProp ?? ctxMastery ?? {};
  const demoMode = demoModeProp ?? ctxDemoMode ?? false;
  const resourcesSubTab = resourcesSubTabProp ?? ctxResourcesSubTab ?? "notes";
  const setResourcesSubTab = setResourcesSubTabProp ?? ctxSetResourcesSubTab;
  const outlineProgress = outlineProgressProp ?? ctxOutlineProgress ?? {};
  if (loading) {
    return (
      <div className="card">
        <CardSkeleton />
        <div style={{ height: 16 }} />
        <ListSkeleton count={3} />
      </div>
    );
  }
  return (
    <div className="card">
      <h2>📚 Study Resources</h2>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { id: "notes", label: "📝 Notes" },
          { id: "flashcards", label: "🔄 Flashcards" },
          { id: "cheatsheet", label: "📋 Cheat Sheets" },
          { id: "outline", label: "📑 Course Outline" },
        ].map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setResourcesSubTab(id)}
            style={{
              padding: "9px 18px", borderRadius: 10, cursor: "pointer", fontSize: 13, fontWeight: 600,
              border: resourcesSubTab === id ? "2px solid #f59e0b" : "1px solid rgba(245,158,11,0.25)",
              background: resourcesSubTab === id ? "linear-gradient(135deg,#d97706,#f59e0b)" : "rgba(20,20,20,0.6)",
              color: resourcesSubTab === id ? "#fff" : "#fcd34d",
            }}
          >{label}</button>
        ))}
      </div>

      {resourcesSubTab === "notes" && (
        <>
          {demoMode && (
            <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 16 }}>📝</span>
                <span style={{ fontSize: 13 }}>Free Trial: {DEMO_LIMITS.notesLimit - Object.values(notes).flat().length} notes remaining.</span>
              </div>
            </div>
          )}
          <NotesEditor
            subjects={subjects}
            notes={notes}
            setNotes={(newNotes) => {
              if (demoMode) {
                const noteCount = Object.values(newNotes).flat().length;
                if (noteCount > DEMO_LIMITS.notesLimit) {
                  toast.warning(`Free Trial limit: Max ${DEMO_LIMITS.notesLimit} notes. Upgrade for unlimited!`);
                  return;
                }
              }
              setNotes(newNotes);
            }}
            demoMode={demoMode}
          />
        </>
      )}

      {resourcesSubTab === "flashcards" && (
        <FlashcardDeck
          subjects={subjects}
          srData={srData}
          customFlashcards={customFlashcards}
          setCustomFlashcards={setCustomFlashcards}
          token={token}
        />
      )}

      {resourcesSubTab === "cheatsheet" && (
        <CheatSheet subjects={subjects} mastery={mastery} />
      )}

      {resourcesSubTab === "outline" && (
        <CourseOutline
          subjects={subjects}
          outlineSubjectId={outlineSubjectId}
          setOutlineSubjectId={setOutlineSubjectId}
          startSubjectPractice={startSubjectPractice}
          addNote={(text) => setNotes((p) => ({ ...p, [outlineSubjectId]: text }))}
          outlineProgress={outlineProgress}
          setOutlineProgress={setOutlineProgress}
          toast={toast}
        />
      )}
    </div>
  );
}

export default memo(Resources);
