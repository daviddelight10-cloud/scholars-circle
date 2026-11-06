import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/constants";
import GroupStreak from "./GroupStreak.jsx";
import GroupLeaderboard from "./GroupLeaderboard.jsx";

// Group XP total this week — fueled by every member's practice (GroupXpEvent
// ledger). Polls quietly like the rest of the board.
function GroupXpHero({ classroomId, token }) {
  const [data, setData] = useState(null);
  const load = useCallback(() => {
    fetch(`${API_BASE}/study-group/${classroomId}/xp`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => {});
  }, [classroomId, token]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;
  const members = data.members || [];
  const active = members.filter((m) => m.weekXp > 0).length;
  const mvp = members.find((m) => m.mvp);
  return (
    <div className="fd-group-pulse gv-signal" style={{ marginBottom: 8 }}>
      <span className="gv-signal-chip hot">⚡ {data.weekXp.toLocaleString()} XP this week</span>
      <span className="gv-signal-chip">{active}/{members.length} members practised</span>
      <span className="gv-signal-chip">{data.allXp.toLocaleString()} XP all-time</span>
      {mvp && <span className="gv-signal-chip battle">🏅 MVP {mvp.name?.split(" ")[0] || "—"}</span>}
    </div>
  );
}

// Board tab = group XP hero + group streak + member leaderboard. One
// competitive view.
export default function GroupBoard({ classroomId, token }) {
  return (
    <div className="gv-board-tab">
      <GroupXpHero classroomId={classroomId} token={token} />
      <GroupStreak classroomId={classroomId} token={token} />
      <GroupLeaderboard classroomId={classroomId} token={token} />
    </div>
  );
}
