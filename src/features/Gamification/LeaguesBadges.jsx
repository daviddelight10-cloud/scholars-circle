import { useState, useEffect } from "react";
import { getMyLeague, getLeagueStandings, getAllBadges, getMyBadges, checkBadges } from "../../lib/gamificationApi";

const TIER_CONFIG = {
  bronze: { color: "#cd7f32", icon: "🥉", label: "Bronze", next: "silver", xpNeeded: 200 },
  silver: { color: "#c0c0c0", icon: "🥈", label: "Silver", next: "gold", xpNeeded: 500 },
  gold: { color: "#ffd700", icon: "🥇", label: "Gold", next: "platinum", xpNeeded: 1000 },
  platinum: { color: "#e5e4e2", icon: "💎", label: "Platinum", next: "diamond", xpNeeded: 2000 },
  diamond: { color: "#b9f2ff", icon: "👑", label: "Diamond", next: null, xpNeeded: null },
};

export default function LeaguesBadges({ token }) {
  const [tab, setTab] = useState("league"); // league | badges | standings
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [myBadges, setMyBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newBadges, setNewBadges] = useState([]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      getMyLeague(token),
      getMyBadges(token),
      getAllBadges(token),
    ]).then(([l, mb, ab]) => {
      setLeague(l);
      setMyBadges(mb);
      setAllBadges(ab);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || tab !== "standings") return;
    getLeagueStandings(token, league?.tier).then(setStandings).catch(() => {});
  }, [token, tab, league?.tier]);

  const handleCheckBadges = async () => {
    const result = await checkBadges(token);
    if (result.awarded?.length) {
      setNewBadges(result.awarded);
      // Refresh badges
      getMyBadges(token).then(setMyBadges);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
        <div className="spinner" />
      </div>
    );
  }

  const tierInfo = TIER_CONFIG[league?.tier || "bronze"];
  const progress = tierInfo.xpNeeded ? Math.min(100, ((league?.weeklyXP || 0) / tierInfo.xpNeeded) * 100) : 100;
  const earnedKeys = new Set(myBadges.map(b => b.badge?.key || b.badgeId));

  return (
    <div style={{ padding: "16px 0" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, padding: "0 4px" }}>
        {[
          { key: "league", label: "🏆 My League" },
          { key: "badges", label: "🎖️ Badges" },
          { key: "standings", label: "📊 Standings" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "10px 8px", border: "none", borderRadius: 10,
              background: tab === t.key ? "var(--accent-color, #3b82f6)" : "var(--card-bg, #1e293b)",
              color: tab === t.key ? "#fff" : "var(--text-secondary, #94a3b8)",
              fontWeight: 600, fontSize: 12, cursor: "pointer", transition: "all 0.2s",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* New badge notification */}
      {newBadges.length > 0 && (
        <div style={{ background: "rgba(255,215,0,0.15)", border: "1px solid rgba(255,215,0,0.4)", borderRadius: 12, padding: 16, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎉</div>
          <div style={{ fontWeight: 600, color: "#ffd700", marginBottom: 4 }}>New Badge{newBadges.length > 1 ? "s" : ""} Earned!</div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 8 }}>
            {newBadges.map(b => (
              <div key={b.key} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28 }}>{b.icon}</div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{b.name}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setNewBadges([])} style={{ marginTop: 12, background: "none", border: "1px solid rgba(255,215,0,0.4)", color: "#ffd700", borderRadius: 8, padding: "6px 16px", cursor: "pointer", fontSize: 11 }}>
            Dismiss
          </button>
        </div>
      )}

      {/* League Tab */}
      {tab === "league" && (
        <div>
          {/* Tier Card */}
          <div style={{
            background: `linear-gradient(135deg, ${tierInfo.color}22, ${tierInfo.color}11)`,
            border: `2px solid ${tierInfo.color}66`,
            borderRadius: 16, padding: 24, textAlign: "center", marginBottom: 16,
          }}>
            <div style={{ fontSize: 48, marginBottom: 8 }}>{tierInfo.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: tierInfo.color, marginBottom: 4 }}>{tierInfo.label} League</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>
              {league?.weeklyXP || 0} XP this week
            </div>

            {/* Progress to next tier */}
            {tierInfo.next && (
              <div style={{ maxWidth: 280, margin: "0 auto" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
                  <span>{tierInfo.label}</span>
                  <span>{TIER_CONFIG[tierInfo.next].label}</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: tierInfo.color, borderRadius: 8, transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  {tierInfo.xpNeeded - (league?.weeklyXP || 0)} XP to promote
                </div>
              </div>
            )}

            {!tierInfo.next && (
              <div style={{ fontSize: 13, color: "#ffd700", fontWeight: 600 }}>🌟 Maximum tier reached!</div>
            )}
          </div>

          {/* League promoted banner */}
          {league?.promoted && (
            <div style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.4)", borderRadius: 12, padding: 14, textAlign: "center", marginBottom: 16 }}>
              <span style={{ fontSize: 18 }}>🎊</span>
              <span style={{ marginLeft: 8, fontWeight: 600, color: "#10b981" }}>You were promoted this week!</span>
            </div>
          )}

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div style={{ background: "var(--card-bg, #1e293b)", borderRadius: 12, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{myBadges.length}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Badges Earned</div>
            </div>
            <div style={{ background: "var(--card-bg, #1e293b)", borderRadius: 12, padding: 16, textAlign: "center" }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)" }}>{league?.weeklyXP || 0}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Weekly XP</div>
            </div>
          </div>

          <button
            onClick={handleCheckBadges}
            style={{ marginTop: 16, width: "100%", padding: "12px", border: "none", borderRadius: 10, background: "var(--accent-color, #3b82f6)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            🔍 Check for New Badges
          </button>
        </div>
      )}

      {/* Badges Tab */}
      {tab === "badges" && (
        <div>
          {/* Category groups */}
          {["streak", "league", "duel", "study", "social"].map(cat => {
            const catBadges = allBadges.filter(b => b.category === cat);
            if (!catBadges.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 10, textTransform: "capitalize" }}>
                  {cat === "streak" ? "🔥 Streak" : cat === "league" ? "🏆 League" : cat === "duel" ? "⚔️ Duel" : cat === "study" ? "📚 Study" : "🦋 Social"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 10 }}>
                  {catBadges.map(badge => {
                    const earned = earnedKeys.has(badge.key) || earnedKeys.has(badge.id);
                    return (
                      <div key={badge.id} style={{
                        background: earned ? "rgba(255,215,0,0.1)" : "var(--card-bg, #1e293b)",
                        border: earned ? "1px solid rgba(255,215,0,0.4)" : "1px solid var(--border-color, #334155)",
                        borderRadius: 12, padding: 12, textAlign: "center",
                        opacity: earned ? 1 : 0.5, transition: "all 0.2s",
                      }}>
                        <div style={{ fontSize: 24, marginBottom: 4, filter: earned ? "none" : "grayscale(1)" }}>{badge.icon}</div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: earned ? "#ffd700" : "var(--text-muted)" }}>{badge.name}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 8 }}>
            {myBadges.length}/{allBadges.length} badges earned
          </div>
        </div>
      )}

      {/* Standings Tab */}
      {tab === "standings" && (
        <div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12, textAlign: "center" }}>
            {tierInfo.icon} {tierInfo.label} League — Weekly Rankings
          </div>
          {standings.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>No players yet</div>
          )}
          {standings.map((s, i) => (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
              background: i < 3 ? "rgba(255,215,0,0.06)" : "var(--card-bg, #1e293b)",
              borderRadius: 10, marginBottom: 6,
              border: i === 0 ? "1px solid rgba(255,215,0,0.3)" : "1px solid var(--border-color, #334155)",
            }}>
              <div style={{ width: 28, fontWeight: 700, fontSize: 14, color: i === 0 ? "#ffd700" : i === 1 ? "#c0c0c0" : i === 2 ? "#cd7f32" : "var(--text-muted)" }}>
                {i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${i + 1}`}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.user?.username || "Student"}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: tierInfo.color }}>{s.weeklyXP} XP</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
