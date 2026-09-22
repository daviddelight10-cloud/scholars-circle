import { memo } from "react";
import ProfileScreen from "../features/settings/ProfileScreen.jsx";
import { CardSkeleton } from "../components/LoadingSkeleton";
import { useAuth } from "../contexts/AuthContext";

function Profile({
  studentProfile,
  authUser: authUserProp,
  onSave,
  onUsernameChange,
  loading,
  stats,
  token,
  isActivated,
  onOpenPremium,
  onBack,
}) {
  const { user: ctxUser } = useAuth();
  const authUser = authUserProp ?? ctxUser;
  if (loading) {
    return <CardSkeleton />;
  }
  return (
    <ProfileScreen
      profile={studentProfile}
      authUser={authUser}
      onSave={onSave}
      onUsernameChange={onUsernameChange}
      stats={stats}
      token={token}
      isActivated={isActivated}
      onOpenPremium={onOpenPremium}
      onBack={onBack}
    />
  );
}

export default memo(Profile);
