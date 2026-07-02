import React, { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

async function pollsApi(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed`);
  return data;
}

/**
 * Floating polls panel overlay shown inside the LiveSessionRoom.
 * Host: can create + end polls.
 * Attendees: can vote and see results.
 */
export function PollsOverlay({ sessionId, isHost, token }) {
  const [open, setOpen] = useState(false);
  const [polls, setPolls] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    try {
      const list = await pollsApi(`/polls/sessions/${sessionId}`, { token });
      setPolls(list);
    } catch {}
  }

  useEffect(() => {
    if (!open) return;
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line
  }, [open, sessionId]);

  const activePoll = polls.find((p) => p.status === "active");

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: "fixed",
          bottom: 80,
          right: 16,
          zIndex: 10000,
          padding: "12px 16px",
          borderRadius: 999,
          border: "none",
          background: activePoll && !isHost ? "#ef4444" : "linear-gradient(135deg, #FFD700, #DAA520)",
          color: "#fff",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          animation: activePoll && !isHost ? "scPollPulse 2s infinite" : undefined
        }}
      >
        📊 {open ? "Close Polls" : activePoll && !isHost ? "Active Poll!" : "Polls"}
        {polls.length > 0 && !open && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 99, background: "rgba(255,255,255,0.25)", fontSize: 11 }}>{polls.length}</span>}
      </button>

      {open && (
        <div style={{
          position: "fixed",
          bottom: 140,
          right: 16,
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "70vh",
          overflowY: "auto",
          zIndex: 10000,
          background: "#1e293b",
          border: "1px solid rgba(255,215,0,0.4)",
          borderRadius: 12,
          padding: 14,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>📊 Polls</h3>
            {isHost && (
              <button onClick={() => setShowCreate(!showCreate)} style={btnSm}>
                {showCreate ? "✕" : "➕ New"}
              </button>
            )}
          </div>

          {showCreate && isHost && (
            <CreatePollForm sessionId={sessionId} token={token} onCreated={() => { setShowCreate(false); load(); }} />
          )}

          {polls.length === 0 && !showCreate && (
            <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 20 }}>
              {isHost ? "No polls yet — create one!" : "No polls yet."}
            </div>
          )}

          {polls.map((p) => (
            <PollCard key={p.id} poll={p} isHost={isHost} token={token} onChange={load} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes scPollPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); box-shadow: 0 4px 24px rgba(239,68,68,0.5); }
        }
      `}</style>
    </>
  );
}

function CreatePollForm({ sessionId, token, onCreated }) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const filtered = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || filtered.length < 2) return;
    setBusy(true);
    try {
      await pollsApi(`/polls/sessions/${sessionId}`, {
        method: "POST",
        token,
        body: { question: question.trim(), options: filtered }
      });
      setQuestion("");
      setOptions(["", ""]);
      onCreated?.();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginBottom: 12, padding: 10, background: "rgba(10,10,10,0.6)", borderRadius: 8 }}>
      <input
        required
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Question..."
        style={{ ...inp, marginBottom: 6 }}
      />
      {options.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: 4, marginBottom: 4 }}>
          <input
            value={o}
            onChange={(e) => setOptions(options.map((x, j) => j === i ? e.target.value : x))}
            placeholder={`Option ${i + 1}`}
            style={{ ...inp, flex: 1 }}
          />
          {options.length > 2 && (
            <button type="button" onClick={() => setOptions(options.filter((_, j) => j !== i))} style={{ ...btnSm, background: "rgba(239,68,68,0.2)" }}>✕</button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button type="button" onClick={() => setOptions([...options, ""])} style={{ ...btnSm, marginBottom: 6 }}>+ Add option</button>
      )}
      <button type="submit" disabled={busy || !question.trim()} style={{ ...btnSm, width: "100%", background: "linear-gradient(135deg, #FFD700, #DAA520)" }}>
        {busy ? "Creating..." : "🚀 Launch Poll"}
      </button>
    </form>
  );
}

function PollCard({ poll, isHost, token, onChange }) {
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);

  async function loadResults() {
    try {
      const r = await pollsApi(`/polls/${poll.id}/results`, { token });
      setResults(r);
    } catch {}
  }

  useEffect(() => {
    loadResults();
    if (poll.status === "active") {
      const t = setInterval(loadResults, 3000);
      return () => clearInterval(t);
    }
    // eslint-disable-next-line
  }, [poll.id, poll.status]);

  async function vote(idx) {
    setBusy(true);
    try {
      await pollsApi(`/polls/${poll.id}/vote`, { method: "POST", token, body: { optionIndex: idx } });
      await loadResults();
    } catch (e) {
      alert("Failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function endPoll() {
    if (!confirm("End this poll? Results will be locked.")) return;
    try {
      await pollsApi(`/polls/${poll.id}/end`, { method: "POST", token });
      onChange?.();
    } catch (e) {
      alert("Failed: " + e.message);
    }
  }

  if (!results) return null;

  const total = results.total || 0;
  const showResults = poll.status === "ended" || isHost || results.myVote !== null;

  return (
    <div style={{
      marginBottom: 10,
      padding: 10,
      background: poll.status === "active" ? "rgba(255,215,0,0.15)" : "rgba(10,10,10,0.6)",
      border: `1px solid ${poll.status === "active" ? "rgba(255,215,0,0.4)" : "rgba(255,215,0,0.15)"}`,
      borderRadius: 8
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <b style={{ flex: 1, fontSize: 13 }}>{results.question}</b>
        <span style={{
          padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
          background: poll.status === "active" ? "#10b981" : "#64748b", color: "#fff"
        }}>
          {poll.status === "active" ? "● LIVE" : "ENDED"}
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        {results.options.map((opt, i) => {
          const count = results.counts[i] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const voted = results.myVote === i;
          if (showResults) {
            return (
              <div key={i} style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 2 }}>
                  <span>{voted && "✓ "}{opt}</span>
                  <span style={{ color: "#FFD700" }}>{pct}% ({count})</span>
                </div>
                <div style={{ height: 6, background: "rgba(10,10,10,0.6)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: voted ? "#10b981" : "#FFD700", transition: "width 0.5s" }} />
                </div>
              </div>
            );
          }
          return (
            <button
              key={i}
              onClick={() => vote(i)}
              disabled={busy || poll.status !== "active"}
              style={{
                display: "block", width: "100%", marginBottom: 4,
                padding: "8px 10px", borderRadius: 6, fontSize: 12,
                border: "1px solid rgba(255,215,0,0.4)",
                background: "rgba(20,20,20,0.6)",
                color: "#fff", textAlign: "left", cursor: "pointer"
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af", display: "flex", justifyContent: "space-between" }}>
        <span>{total} vote{total !== 1 ? "s" : ""}</span>
        {isHost && poll.status === "active" && (
          <button onClick={endPoll} style={{ ...btnSm, background: "rgba(239,68,68,0.3)", padding: "2px 8px" }}>End Poll</button>
        )}
      </div>
    </div>
  );
}

const inp = {
  width: "100%",
  padding: 6,
  borderRadius: 6,
  border: "1px solid rgba(255,215,0,0.3)",
  background: "rgba(10,10,10,0.7)",
  color: "#fff",
  fontSize: 13,
  boxSizing: "border-box"
};
const btnSm = {
  padding: "4px 10px",
  borderRadius: 6,
  border: "none",
  background: "rgba(255,215,0,0.3)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600
};
