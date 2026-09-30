import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "../../lib/constants";
import { Avatar } from "../feed/feedUi";

const MILESTONES = [
  { days: 3, emoji: "🌱", label: "Getting started" },
  { days: 7, emoji: "🔥", label: "1 week strong" },
  { days: 14, emoji: "⚡", label: "2 weeks unstoppable" },
  { days: 30, emoji: "🏆", label: "Monthly masters" },
  { days: 50, emoji: "💎", label: "Diamond scholars" },
  { days: 100, emoji: "👑", label: "Legendary" },
];

// Compact streak hero rendered at the top of the Board tab.
export default function GroupStreak({ classroomId, token }) {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/streak`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      setData(await res.json());
    } catch {}
  }, [classroomId, token]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  if (!data) return null;

  const { groupStreak, totalMembers, studiedToday, activeNow, memberStreaks } = data;
  const next = MILESTONES.find((m) => m.days > groupStreak);
  const prev = [...MILESTONES].reverse().find((m) => m.days <= groupStreak);
  const pct = next ? Math.round(((groupStreak - (prev?.days || 0)) / (next.days - (prev?.days || 0))) * 100) : 100;
  const topStreaks = (memberStreaks || []).filter((m) => m.streak > 0).sort((a, b) => b.streak - a.streak).slice(0, 6);

  return (
    <div className="gv-streak-hero">
      <div className="gv-streak-left">
        <div className="gv-streak-flame">{groupStreak > 0 ? "🔥" : "💤"}</div>
        <div>
          <div className="gv-streak-num">{groupStreak}<span className="gv-streak-unit"> day streak</span></div>
          <div className="gv-streak-sub">
            {studiedToday}/{totalMembers} studied today{activeNow > 0 ? ` · ${activeNow} in rooms now` : ""}
          </div>
        </div>
      </div>

      {next && (
        <div className="gv-streak-milestone">
          <div className="gv-streak-milestone-top">
            <span>Next: {next.emoji} {next.label}</span>
            <span>{groupStreak}/{next.days}d</span>
          </div>
          <div className="gv-streak-bar"><div className="gv-streak-fill" style={{ width: `${pct}%` }} /></div>
        </div>
      )}

      {topStreaks.length > 0 && (
        <div className="gv-streak-members">
          {topStreaks.map((m) => (
            <span key={m.userId} className="gv-streak-member" title={m.name}>
              <Avatar user={{ avatar: m.avatar, name: m.name }} size={18} />
              {m.streak}d
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
