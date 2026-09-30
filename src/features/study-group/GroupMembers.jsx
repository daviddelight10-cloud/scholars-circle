import { Avatar } from "../feed/feedUi";
import { levelProgress } from "../streak-survival/survivalStore";

// Members grid — avatars, live XP/streak stats. Tap opens the app ProfileSheet
// (Message + Follow come free) via the onOpenProfile prop.
export default function GroupMembers({ currentUser, members = [], onOpenProfile }) {
  const myId = currentUser?.id || currentUser?.sub;

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
                {m.isCreator ? "Creator" : u.role === "TEACHER" || u.role === "LECTURER" ? "Faculty" : "Student"}
              </span>
            </span>
            <span className="gv-member-stats">
              <span className="gv-member-pill">⚡ {(m.xp || 0).toLocaleString()}</span>
              <span className="gv-member-pill">🔥 {m.streak || 0}d</span>
              <span className="gv-member-pill lvl">LVL {lvl}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
