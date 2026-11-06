import { useState } from "react";
import { Avatar } from "../feed/feedUi";
import { groupsApi } from "../groups/groupsApi";
import { levelProgress } from "../streak-survival/survivalStore";

// Members grid — avatars, live XP/streak stats. Tap opens the app ProfileSheet
// (Message + Follow come free) via the onOpenProfile prop. The creator sees a
// captain promote/demote control — captains set battle lineups.
export default function GroupMembers({ classroomId, token, currentUser, members = [], onOpenProfile, onRefresh }) {
  const myId = currentUser?.id || currentUser?.sub;
  const [busyId, setBusyId] = useState(null);
  const iAmCreator = members.some((m) => m.isCreator && m.user?.id === myId);

  const toggleCaptain = async (e, m) => {
    e.stopPropagation();
    const uid = m.user?.id;
    if (!uid || busyId) return;
    setBusyId(uid);
    try {
      await groupsApi.promote({ token, id: classroomId, userId: uid, role: m.role === "captain" ? "member" : "captain" });
      onRefresh?.();
    } catch (err) {
      alert(err.message || "Couldn't update role");
    } finally {
      setBusyId(null);
    }
  };

  if (members.length === 0) {
    return (
      <div className="fd-skeletons">
        {[0, 1, 2].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 84 }} />)}
      </div>
    );
  }

  return (
    <div className="gv-members">
      {members.map((m) => {
        const u = m.user || {};
        const isMe = u.id === myId;
        const lvl = levelProgress(m.xp || 0).level;
        return (
          <button
            key={m.id || u.id}
            className="gv-member"
            onClick={() => onOpenProfile?.(u.id)}
            disabled={!onOpenProfile}
            style={!onOpenProfile ? { cursor: "default" } : undefined}
          >
            <span className="gv-member-avatar">
              <Avatar user={u} size={46} />
              {m.isCreator && <span className="gv-member-crown">👑</span>}
            </span>
            <span className="gv-member-info">
              <span className="gv-member-name">
                {u.name || "Scholar"} {isMe && <span className="gv-you">you</span>}
              </span>
              <span className="gv-member-role">
                {m.isCreator ? "Creator" : m.role === "captain" ? "⚔️ Captain" : u.role === "TEACHER" || u.role === "LECTURER" ? "Faculty" : "Student"}
              </span>
            </span>
            <span className="gv-member-stats">
              <span className="gv-member-pill">⚡ {(m.xp || 0).toLocaleString()}</span>
              <span className="gv-member-pill">🔥 {m.streak || 0}d</span>
              <span className="gv-member-pill lvl">LVL {lvl}</span>
              {iAmCreator && !m.isCreator && !isMe && (
                <span
                  className="gv-member-pill lvl"
                  role="button"
                  style={{ cursor: "pointer", opacity: busyId === u.id ? 0.5 : 1 }}
                  onClick={(e) => toggleCaptain(e, m)}
                  title={m.role === "captain" ? "Remove captain" : "Make captain — can set battle lineups"}
                >
                  {busyId === u.id ? "…" : m.role === "captain" ? "⚔️ demote" : "⚔️ +captain"}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
