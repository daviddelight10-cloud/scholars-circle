import { useMemo } from "react";
import { BADGES, BADGE_GROUPS, resolveBadges } from "../../lib/badges.js";

function BadgeCard({ b }) {
  const masked = b.hidden && !b.earned;
  const pct = Math.round((b.cur / b.max) * 100);
  return (
    <div className={`sd-badge${b.earned ? " earned" : ""}${b.rarity === "rare" ? " rare" : ""}${b.rarity === "legendary" ? " legendary" : ""}${masked ? " masked" : ""}`}>
      <span className="sd-badge-ic">{masked ? "❓" : b.icon}</span>
      <div className="sd-badge-info">
        <strong>{masked ? "???" : b.label}</strong>
        <span className="sd-badge-desc">{masked ? "Hidden achievement — keep studying" : b.desc}</span>
        {!b.earned && b.max > 1 && (
          <div className="sd-badge-prog">
            <div className="sd-badge-bar"><i style={{ width: `${pct}%` }} /></div>
            <em>{b.cur}/{b.max}</em>
          </div>
        )}
      </div>
      {b.earned && <span className="sd-badge-check">✓</span>}
    </div>
  );
}

export default function BadgesSection({ ctx }) {
  const rows = useMemo(() => resolveBadges(ctx), [ctx]);
  const earnedCount = rows.filter((r) => r.earned).length;
  const overallPct = Math.round((earnedCount / BADGES.length) * 100);

  return (
    <div className="sd-panel sd-badges">
      <div className="sd-panel-head">
        <h3>Achievements</h3>
        <span className="sd-panel-meta">{earnedCount}/{BADGES.length} · {overallPct}%</span>
      </div>
      <div className="sd-xpbar" style={{ marginBottom: 14 }}>
        <i style={{ width: `${overallPct}%` }} />
      </div>

      {BADGE_GROUPS.map((g) => {
        const groupBadges = rows
          .filter((r) => r.group === g.id)
          .sort((x, y) => (y.earned ? 1 : 0) - (x.earned ? 1 : 0) || y.cur / y.max - x.cur / x.max);
        if (groupBadges.length === 0) return null;
        const gEarned = groupBadges.filter((r) => r.earned).length;
        return (
          <div key={g.id} className="sd-badgegroup">
            <div className="sd-badgegroup-head">
              <span>{g.icon} {g.label}</span>
              <em>{gEarned}/{groupBadges.length}</em>
            </div>
            <div className="sd-badgegrid">
              {groupBadges.map((b) => <BadgeCard key={b.id} b={b} />)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
