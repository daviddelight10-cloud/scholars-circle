import React, { memo } from "react";
import { Classroom as ClassroomComponent } from "../components/Classroom";
import DemoLockedOverlay from "../components/DemoLockedOverlay";
import { api } from "../lib/appUtils";
import { CardSkeleton, ListSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";
import { useUI } from "../contexts/UIContext";
import { useUserData } from "../contexts/UserDataContext";

function Classroom({
  subjects: subjectsProp,
  assignments: assignmentsProp,
  setAssignments,
  refreshAssignments,
  isFaculty: isFacultyProp,
  authUser: authUserProp,
  token: tokenProp,
  demoMode: demoModeProp,
  backendSubjects,
  onImportQuestions,
  loading,
}) {
  const { user: ctxUser, token: ctxToken, isFaculty: ctxIsFaculty } = useAuth();
  const { subjects: ctxSubjects, assignments: ctxAssignments } = useUserData();
  const { demoMode: ctxDemoMode } = useUI();

  const subjects = subjectsProp ?? ctxSubjects ?? [];
  const assignments = assignmentsProp ?? ctxAssignments ?? [];
  const isFaculty = isFacultyProp ?? ctxIsFaculty ?? false;
  const authUser = authUserProp ?? ctxUser;
  const token = tokenProp ?? ctxToken;
  const demoMode = demoModeProp ?? ctxDemoMode ?? false;
  if (loading) {
    return (
      <>
        <CardSkeleton />
        <div style={{ height: 16 }} />
        <ListSkeleton count={3} />
      </>
    );
  }
  if (demoMode) {
    return (
      <DemoLockedOverlay
        title="🏫 Classroom Locked"
        description="Join virtual classrooms, participate in discussions, and submit assignments. Upgrade to Pro for full classroom access!"
        icon="🏫"
      />
    );
  }

  return (
    <ClassroomComponent
      subjects={subjects}
      assignments={assignments}
      teacherMode={isFaculty}
      setTeacherMode={() => {}}
      currentUser={authUser}
      token={token}
      onCreate={async (a) => {
        try {
          if (token) {
            const backendSubject = backendSubjects.find(
              (s) => s.label === subjects.find((x) => x.id === a.subjectId)?.label
            );
            if (backendSubject) {
              await api("/assignments", {
                token,
                method: "POST",
                body: { title: a.title, subjectId: backendSubject.id, dueAt: a.due || null },
              });
              refreshAssignments();
            }
          }
        } catch {
          setAssignments((prev) => [...prev, a]);
        }
      }}
      onComplete={async (id) => {
        try {
          await api("/api/assignments/complete", "POST", { id }, token);
        } catch {
          // ignore offline
        }
        setAssignments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, completed: true, completedAt: new Date().toISOString() } : a))
        );
      }}
      onImportQuestions={onImportQuestions}
    />
  );
}

export default memo(Classroom);
