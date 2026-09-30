import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/constants";
import { Avatar } from "../feed/feedUi";
import { levelProgress } from "../streak-survival/survivalStore";

const SORT_OPTIONS = [
  { value: "week", label: "This week" },
  { value: "all", label: "All-time" },
  { value: "streak", label: "Streak" },
];

function medal(i) {
  return i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
}

export default function GroupLeaderboard({ classroomId, token }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState("week");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/leaderboard?sort=${sort}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load");
      setEntries(await res.json());
    } catch (err) {
      console.error("Leaderboard error:", err);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token, sort]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const valueOf = (e) =>
    sort === "streak" ? `${e.streak}d` : sort === "all" ? `${e.xp.toLocaleString()} XP` : `+${e.weeklyXP.toLocaleString()}`;

  const subOf = (e) => `🔥 ${e.streak}d · ${e.accuracy}% acc`;

  if (loading) {
    return (
      <div className="fd-skeletons">
        {[0, 1, 2, 3].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 56 }} />)}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="fd-empty">
        <div className="fd-empty-icon">🏆</div>
        <div className="fd-empty-title">No data yet</div>
        <div className="fd-empty-sub">Answer quiz questions to climb the group board.</div>
      </div>
    );
  }

  // Podium order: 2nd, 1st, 3rd visually (winner center)
  const top = entries.slice(0, 3);
  const podiumOrder = [top[1], top[0], top[2]].filter(Boolean);
  const rest = entries.slice(3);

  return (
    <div className="gv-board">
      <div className="gv-sort-row">
        {SORT_OPTIONS.map((o) => (
          <button
            key={o.value}
            className={`gv-sort ${sort === o.value ? "active" : ""}`}
            onClick={() => setSort(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="gv-podium">
        {podiumOrder.map((e) => {
          const rank = entries.indexOf(e);
          const lvl = levelProgress(e.xp).level;
          return (
            <div key={e.userId} className={`gv-podium-card r${rank} ${e.isMe ? "me" : ""}`}>
              {rank === 0 && <span className="gv-podium-crown">👑</span>}
              <Avatar user={{ avatar: e.avatar, name: e.name }} size={rank === 0 ? 52 : 42} />
              <div className="gv-podium-name">
                {e.name?.split(" ")[0] || e.username} {e.isMe && <span className="gv-you">you</span>}
              </div>
              <div className="gv-podium-medal">{medal(rank)}</div>
              <div className="gv-podium-val">{valueOf(e)}</div>
              <div className="gv-podium-sub">LVL {lvl}</div>
            </div>
          );
        })}
      </div>

      <div className="gv-lb-list">
        {rest.map((e, i) => {
          const lvl = levelProgress(e.xp).level;
          return (
            <div key={e.userId} className={`gv-lb-row ${e.isMe ? "me" : ""}`}>
              <span className="gv-lb-rank">#{i + 4}</span>
              <Avatar user={{ avatar: e.avatar, name: e.name }} size={34} />
              <span className="gv-lb-who">
                <span className="gv-lb-name">
                  {e.name} {e.isMe && <span className="gv-you">you</span>}
                </span>
                <span className="gv-lb-sub">{subOf(e)}</span>
              </span>
              <span className="gv-lb-lvl">LVL {lvl}</span>
              <span className="gv-lb-val">{valueOf(e)}</span>
            </div>
          );
        })}
      </div>

      {entries.length <= 3 && rest.length === 0 && entries.some((e) => e.isMe) && (
        <div className="gv-lb-foot">You're on the podium — keep pushing 🔥</div>
      )}
    </div>
  );
}
