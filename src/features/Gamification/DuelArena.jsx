import { useState, useEffect, useCallback } from "react";
import { getMyDuels, getDuelDetail, createDuel, acceptDuel, declineDuel, answerDuel } from "../../lib/gamificationApi";

export default function DuelArena({ token, userId, leaderboard = [] }) {
  const [view, setView] = useState("list"); // list | create | play | result
  const [duels, setDuels] = useState([]);
  const [activeDuel, setActiveDuel] = useState(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answering, setAnswering] = useState(false);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetUser, setTargetUser] = useState("");
  const [error, setError] = useState(null);

  const refreshDuels = useCallback(() => {
    if (!token) return;
    setLoading(true);
    getMyDuels(token).then(d => {
      setDuels(Array.isArray(d) ? d : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { refreshDuels(); }, [refreshDuels]);

  const handleCreate = async () => {
    if (!targetUser) return;
    setError(null);
    const result = await createDuel(token, targetUser);
    if (result.error) { setError(result.error); return; }
    setView("list");
    refreshDuels();
  };

  const handleAccept = async (duelId) => {
    await acceptDuel(token, duelId);
    refreshDuels();
  };

  const handleDecline = async (duelId) => {
    await declineDuel(token, duelId);
    refreshDuels();
  };

  const handlePlay = async (duelId) => {
    const detail = await getDuelDetail(token, duelId);
    if (detail.error) { setError(detail.error); return; }
    setActiveDuel(detail);
    setCurrentQ(detail.myAnswers?.length || 0);
    setResults([]);
    setView("play");
  };

  const handleAnswer = async (optionIdx) => {
    if (answering || !activeDuel) return;
    setSelected(optionIdx);
    setAnswering(true);
    const q = activeDuel.questions[currentQ];
    const res = await answerDuel(token, activeDuel.id, q.id, optionIdx);
    setResults(prev => [...prev, { questionId: q.id, selected: optionIdx, correct: res.correct }]);

    setTimeout(() => {
      if (res.duelResult) {
        setActiveDuel(prev => ({ ...prev, ...res.duelResult }));
        setView("result");
      } else if (currentQ + 1 < activeDuel.questions.length) {
        setCurrentQ(prev => prev + 1);
        setSelected(null);
      }
      setAnswering(false);
    }, 1000);
  };

  if (loading) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 40 }}><div className="spinner" /></div>;
  }

  // ─── Create View ──────────────────────
  if (view === "create") {
    const opponents = leaderboard.filter(u => u.userId !== userId);
    return (
      <div style={{ padding: "16px 0" }}>
        <button onClick={() => setView("list")} style={{ background: "none", border: "none", color: "var(--accent-color)", cursor: "pointer", fontSize: 13, marginBottom: 16 }}>
          ← Back to Duels
        </button>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--text-primary)" }}>⚔️ Challenge a Student</h3>

        {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12, padding: "8px 12px", background: "rgba(239,68,68,0.1)", borderRadius: 8 }}>{error}</div>}

        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>Select an opponent:</div>
        <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 16 }}>
          {opponents.length === 0 && <div style={{ color: "var(--text-muted)", textAlign: "center", padding: 20 }}>No other students found</div>}
          {opponents.map(u => (
            <div
              key={u.userId}
              onClick={() => setTargetUser(u.userId)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 6,
                background: targetUser === u.userId ? "rgba(59,130,246,0.15)" : "var(--card-bg, #1e293b)",
                border: targetUser === u.userId ? "1px solid var(--accent-color)" : "1px solid var(--border-color, #334155)",
              }}
            >
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--accent-color)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
                {u.username?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{u.username}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{u.xp || 0} XP • {u.streak || 0}🔥</div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={!targetUser}
          style={{
            width: "100%", padding: 12, border: "none", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: targetUser ? "pointer" : "not-allowed",
            background: targetUser ? "var(--accent-color, #3b82f6)" : "var(--border-color, #334155)", color: "#fff",
          }}
        >⚔️ Send Challenge (10 Questions, 20 XP Stake)</button>
      </div>
    );
  }

  // ─── Play View ────────────────────────
  if (view === "play" && activeDuel) {
    const q = activeDuel.questions[currentQ];
    if (!q) {
      return <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>Waiting for questions...</div>;
    }
    const options = [q.optionA, q.optionB, q.optionC, q.optionD];
    const lastResult = results[results.length - 1];

    return (
      <div style={{ padding: "16px 0" }}>
        {/* Progress */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Question {currentQ + 1}/{activeDuel.questions.length}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ✅ {results.filter(r => r.correct).length}/{results.length}
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 8, height: 4, marginBottom: 20, overflow: "hidden" }}>
          <div style={{ width: `${((currentQ + 1) / activeDuel.questions.length) * 100}%`, height: "100%", background: "var(--accent-color)", borderRadius: 8, transition: "width 0.3s" }} />
        </div>

        {/* Question */}
        <div style={{ background: "var(--card-bg, #1e293b)", borderRadius: 14, padding: 20, marginBottom: 16, border: "1px solid var(--border-color, #334155)" }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.5 }}>{q.question}</div>
        </div>

        {/* Options */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((opt, idx) => {
            let bg = "var(--card-bg, #1e293b)";
            let border = "1px solid var(--border-color, #334155)";
            if (selected !== null) {
              if (idx === selected && lastResult?.correct) { bg = "rgba(16,185,129,0.2)"; border = "1px solid #10b981"; }
              else if (idx === selected && !lastResult?.correct) { bg = "rgba(239,68,68,0.2)"; border = "1px solid #ef4444"; }
            }
            return (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                disabled={answering}
                style={{
                  padding: "14px 16px", border, borderRadius: 10, background: bg,
                  color: "var(--text-primary)", fontSize: 13, textAlign: "left", cursor: answering ? "not-allowed" : "pointer", transition: "all 0.2s",
                }}
              >
                <span style={{ fontWeight: 600, marginRight: 8, color: "var(--accent-color)" }}>{String.fromCharCode(65 + idx)}.</span>
                {opt}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ─── Result View ──────────────────────
  if (view === "result" && activeDuel) {
    const isWinner = activeDuel.winnerId === userId;
    const isTie = !activeDuel.winnerId;
    const myScore = activeDuel.challengerId === userId ? activeDuel.challengerScore : activeDuel.challengedScore;
    const theirScore = activeDuel.challengerId === userId ? activeDuel.challengedScore : activeDuel.challengerScore;

    return (
      <div style={{ padding: "16px 0", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>{isTie ? "🤝" : isWinner ? "🏆" : "😤"}</div>
        <h3 style={{ margin: "0 0 8px", fontSize: 18, color: isTie ? "var(--text-primary)" : isWinner ? "#10b981" : "#ef4444" }}>
          {isTie ? "It's a Tie!" : isWinner ? "You Won!" : "You Lost!"}
        </h3>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
          {isWinner ? `+${activeDuel.xpStake * 2} XP earned!` : isTie ? "XP returned" : "Better luck next time!"}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 24, marginBottom: 24 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{myScore}/10</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Your Score</div>
          </div>
          <div style={{ fontSize: 24, color: "var(--text-muted)", alignSelf: "center" }}>vs</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: "var(--text-primary)" }}>{theirScore}/10</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Opponent</div>
          </div>
        </div>

        <button
          onClick={() => { setView("list"); setActiveDuel(null); refreshDuels(); }}
          style={{ padding: "12px 24px", border: "none", borderRadius: 10, background: "var(--accent-color)", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >Back to Duels</button>
      </div>
    );
  }

  // ─── List View (default) ──────────────
  const pendingForMe = duels.filter(d => d.challengedId === userId && d.status === "pending");
  const activeDuels = duels.filter(d => d.status === "active");
  const myPending = duels.filter(d => d.challengerId === userId && d.status === "pending");
  const completed = duels.filter(d => d.status === "completed").slice(0, 10);

  return (
    <div style={{ padding: "16px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "var(--text-primary)" }}>⚔️ Duel Arena</h3>
        <button
          onClick={() => setView("create")}
          style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--accent-color)", color: "#fff", fontWeight: 600, fontSize: 12, cursor: "pointer" }}
        >+ Challenge</button>
      </div>

      {error && <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {/* Incoming challenges */}
      {pendingForMe.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 8 }}>⚡ Incoming Challenges</div>
          {pendingForMe.map(d => (
            <div key={d.id} style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{d.challengerName}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>10 Qs • {d.xpStake} XP stake</div>
              </div>
              <button onClick={() => handleAccept(d.id)} style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Accept</button>
              <button onClick={() => handleDecline(d.id)} style={{ padding: "6px 12px", border: "none", borderRadius: 6, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Decline</button>
            </div>
          ))}
        </div>
      )}

      {/* Active duels */}
      {activeDuels.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#10b981", marginBottom: 8 }}>🎮 Active Duels</div>
          {activeDuels.map(d => (
            <div key={d.id} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                  vs {d.challengerId === userId ? d.challengedName : d.challengerName}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{d.xpStake * 2} XP for winner</div>
              </div>
              <button onClick={() => handlePlay(d.id)} style={{ padding: "8px 14px", border: "none", borderRadius: 8, background: "var(--accent-color)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Play ▶</button>
            </div>
          ))}
        </div>
      )}

      {/* My pending (waiting for opponent) */}
      {myPending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>⏳ Waiting for Opponent</div>
          {myPending.map(d => (
            <div key={d.id} style={{ background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)", borderRadius: 12, padding: 12, marginBottom: 8, display: "flex", alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>vs {d.challengedName}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Waiting for response...</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>📜 Recent Results</div>
          {completed.map(d => {
            const won = d.winnerId === userId;
            const tie = !d.winnerId;
            return (
              <div key={d.id} style={{ background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)", borderRadius: 10, padding: 10, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 18 }}>{tie ? "🤝" : won ? "🏆" : "❌"}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "var(--text-primary)" }}>
                    vs {d.challengerId === userId ? d.challengedName : d.challengerName}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    {d.challengerScore}-{d.challengedScore}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: tie ? "var(--text-muted)" : won ? "#10b981" : "#ef4444" }}>
                  {tie ? "Tie" : won ? `+${d.xpStake * 2} XP` : `-${d.xpStake} XP`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {duels.length === 0 && (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚔️</div>
          <div style={{ fontSize: 13 }}>No duels yet. Challenge someone!</div>
        </div>
      )}
    </div>
  );
}
