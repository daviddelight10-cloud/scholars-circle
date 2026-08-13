import React, { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

export default function QuizBattles({ classroomId, token, currentUser, members, subjects }) {
  const [duels, setDuels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChallenge, setShowChallenge] = useState(false);
  const [selectedMember, setSelectedMember] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  const [battleResult, setBattleResult] = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };
  const myId = currentUser?.id || currentUser?.sub;

  const fetchDuels = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/duels`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setDuels(data);
    } catch (err) {
      console.error("Duels error:", err);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token]);

  useEffect(() => {
    fetchDuels();
    const interval = setInterval(fetchDuels, 10000);
    return () => clearInterval(interval);
  }, [fetchDuels]);

  async function createDuel() {
    if (!selectedMember) return;
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/duels`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ challengedId: selectedMember, subjectId: selectedSubject || null }),
      });
      if (!res.ok) throw new Error("Failed to challenge");
      setShowChallenge(false);
      setSelectedMember("");
      setSelectedSubject("");
      fetchDuels();
    } catch (err) {
      console.error("Challenge error:", err);
    }
  }

  async function respondDuel(duelId, status) {
    try {
      await fetch(`${API_BASE}/study-group/duels/${duelId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ status }),
      });
      fetchDuels();
    } catch (err) {
      console.error("Respond error:", err);
    }
  }

  async function completeDuel(duelId, myScore, theirScore) {
    try {
      const duel = duels.find((d) => d.id === duelId);
      const isChallenger = duel.challengerId === myId;
      const challengerScore = isChallenger ? myScore : theirScore;
      const challengedScore = isChallenger ? theirScore : myScore;
      await fetch(`${API_BASE}/study-group/duels/${duelId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ challengerScore, challengedScore }),
      });
      setBattleResult(null);
      fetchDuels();
    } catch (err) {
      console.error("Complete duel error:", err);
    }
  }

  function getDisplayName(user) {
    return user?.fullName || user?.username || "Scholar";
  }

  function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
  }

  function getStatusBadge(status) {
    const styles = {
      pending: { bg: "rgba(250,204,21,0.15)", color: "#facc15", text: "⏳ Pending" },
      accepted: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa", text: "⚔️ Accepted" },
      declined: { bg: "rgba(239,68,68,0.15)", color: "#f87171", text: "❌ Declined" },
      completed: { bg: "rgba(16,185,129,0.15)", color: "#34d399", text: "✅ Completed" },
    };
    const s = styles[status] || styles.pending;
    return <span className="sg-duel-status" style={{ background: s.bg, color: s.color }}>{s.text}</span>;
  }

  const challengeableMembers = members.filter((m) => m.user?.id !== myId);

  if (loading) {
    return (
      <div className="cr-glass" style={{ textAlign: "center", padding: 40 }}>
        <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 13, color: "#6b7280" }}>Loading battles…</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button className="cr-btn" onClick={() => setShowChallenge(true)}>⚔️ Challenge a Member</button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>{duels.filter((d) => d.status === "pending" && d.challengedId === myId).length} pending challenges</span>
      </div>

      {duels.length === 0 && !showChallenge && (
        <div className="cr-empty" style={{ padding: "32px 20px" }}>
          <div className="cr-empty-icon">⚔️</div>
          <div className="cr-empty-title">No battles yet</div>
          <div className="cr-empty-desc">Challenge a group member to a quiz duel — winner earns XP and bragging rights!</div>
        </div>
      )}

      <div className="sg-duels-list">
        {duels.map((duel) => {
          const isChallenger = duel.challengerId === myId;
          const opponent = isChallenger ? duel.challenged : duel.challenger;
          const myScore = isChallenger ? duel.challengerScore : duel.challengedScore;
          const theirScore = isChallenger ? duel.challengedScore : duel.challengerScore;
          const iWon = duel.status === "completed" && duel.winnerId === myId;
          const iLost = duel.status === "completed" && duel.winnerId && duel.winnerId !== myId;
          const isDraw = duel.status === "completed" && !duel.winnerId;

          return (
            <div key={duel.id} className={`sg-duel-card ${iWon ? "won" : iLost ? "lost" : ""}`}>
              <div className="sg-duel-header">
                <div className="sg-duel-opponents">
                  <div className="sg-duel-fighter">
                    <div className="sg-duel-avatar">{getInitials(getDisplayName(duel.challenger))}</div>
                    <span className="sg-duel-name">{getDisplayName(duel.challenger)}</span>
                  </div>
                  <span className="sg-duel-vs">VS</span>
                  <div className="sg-duel-fighter">
                    <div className="sg-duel-avatar">{getInitials(getDisplayName(duel.challenged))}</div>
                    <span className="sg-duel-name">{getDisplayName(duel.challenged)}</span>
                  </div>
                </div>
                {getStatusBadge(duel.status)}
              </div>

              {duel.status === "completed" && (
                <div className="sg-duel-result">
                  <span className={iWon ? "sg-duel-winner" : ""}>{myScore}</span>
                  <span className="sg-duel-score-sep">-</span>
                  <span className={iLost ? "sg-duel-winner" : ""}>{theirScore}</span>
                  {iWon && <span className="sg-duel-result-badge">🏆 You won!</span>}
                  {iLost && <span className="sg-duel-result-badge">💪 Good fight</span>}
                  {isDraw && <span className="sg-duel-result-badge">🤝 Draw</span>}
                </div>
              )}

              {duel.status === "pending" && !isChallenger && (
                <div className="sg-duel-actions">
                  <button className="cr-btn" style={{ background: "rgba(59,130,246,0.2)", borderColor: "rgba(59,130,246,0.4)" }} onClick={() => respondDuel(duel.id, "accepted")}>
                    ⚔️ Accept
                  </button>
                  <button className="cr-btn-outline" onClick={() => respondDuel(duel.id, "declined")}>
                    Decline
                  </button>
                </div>
              )}

              {duel.status === "pending" && isChallenger && (
                <div className="sg-duel-waiting">Waiting for response…</div>
              )}

              {duel.status === "accepted" && (
                <div className="sg-duel-battle">
                  <div className="sg-duel-battle-label">Enter your score:</div>
                  <div className="sg-duel-battle-row">
                    <input
                      className="cr-input sg-duel-score-input"
                      type="number"
                      min="0"
                      placeholder="Your score"
                      onChange={(e) => setBattleResult({ duelId: duel.id, myScore: parseInt(e.target.value) || 0 })}
                    />
                    <button
                      className="cr-btn"
                      onClick={() => {
                        if (battleResult?.duelId === duel.id) {
                          completeDuel(duel.id, battleResult.myScore, 0);
                        }
                      }}
                    >
                      Submit
                  </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showChallenge && (
        <div className="modal-overlay" onClick={() => setShowChallenge(false)}>
          <div className="modal-content cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">⚔️ Challenge to a Quiz Duel</h3>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Pick a group member to challenge.</p>
            <select className="cr-input" value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} style={{ marginBottom: 8 }}>
              <option value="">Select member…</option>
              {challengeableMembers.map((m) => (
                <option key={m.user?.id} value={m.user?.id}>{getDisplayName(m.user)}</option>
              ))}
            </select>
            <select className="cr-input" value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="">Any subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cr-btn-outline" style={{ flex: 1 }} onClick={() => setShowChallenge(false)}>Cancel</button>
              <button className="cr-btn" style={{ flex: 1 }} onClick={createDuel} disabled={!selectedMember}>Challenge!</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
