import React, { memo } from "react";
import { StudentProfile } from "../features/StudentProfile.jsx";
import { CardSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";

function Profile({
  studentProfile,
  authUser: authUserProp,
  onSave,
  loading,
}) {
  const { user: ctxUser } = useAuth();
  const authUser = authUserProp ?? ctxUser;
  if (loading) {
    return <CardSkeleton />;
  }
  return (
    <StudentProfile
      profile={studentProfile}
      authUser={authUser}
      onSave={onSave}
    />
  );
}

export default memo(Profile);
