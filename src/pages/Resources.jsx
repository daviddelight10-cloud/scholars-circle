import React, { memo } from "react";
import { NotesEditor, CheatSheet } from "../components/StudyTools";
import { CardSkeleton, ListSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";

function Resources({
  subjects: subjectsProp,
  notes: notesProp,
  setNotes,
  token: tokenProp,
  freeTierMode: freeTierModeProp,
  resourcesSubTab: resourcesSubTabProp,
  setResourcesSubTab: setResourcesSubTabProp,
  toast,
  loading,
}) {
  const { token: ctxToken } = useAuth();
  const { subjects: ctxSubjects, notes: ctxNotes } = useUserData();
  const { resourcesSubTab: ctxResourcesSubTab, setResourcesSubTab: ctxSetResourcesSubTab } = useUI();

  const subjects = subjectsProp ?? ctxSubjects ?? [];
  const notes = notesProp ?? ctxNotes ?? {};
  const token = tokenProp ?? ctxToken;
  const resourcesSubTab = resourcesSubTabProp ?? ctxResourcesSubTab ?? "notes";
  const setResourcesSubTab = setResourcesSubTabProp ?? ctxSetResourcesSubTab;
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
          { id: "cheatsheet", label: "📋 Cheat Sheets" },
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
        <NotesEditor
          subjects={subjects}
          notes={notes}
          setNotes={setNotes}
        />
      )}

      {resourcesSubTab === "cheatsheet" && (
        <CheatSheet subjects={subjects} />
      )}
    </div>
  );
}

export default memo(Resources);
