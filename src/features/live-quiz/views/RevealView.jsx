import { useState } from "react";
import { IconCheck, IconX } from "../icons.jsx";
import { sounds } from "../sounds";

function initials(name) {
  return (name || "?").trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function confColor(conf) {
  return conf === "High" ? "#3DD68C" : conf === "Medium" ? "#F5C542" : "#FF6B5E";
}

export default function RevealView({ room, myId, actions }) {
  const r = room.reveal;
  const q = room.question; // still holds question text/options
  const participants = room.participants;
  const byId = Object.fromEntries(participants.map((p) => [p.userId, p]));
  const [tbText, setTbText] = useState("");
  const [tbSent, setTbSent] = useState(false);

  if (!r) return null;

  const myPick = r.picks[myId];
  const iAmTeacher = room.phase === "teachback" && r.soleCorrectId === myId;
  const teacherWaiting = room.phase === "teachback" && r.soleCorrectId && r.soleCorrectId !== myId;
  const teacher = r.soleCorrectId ? byId[r.soleCorrectId] : null;
  const readySet = new Set(room.ready.ready || []);
  const needed = room.ready.needed || [];
  const iAmReady = readySet.has(myId);
  const allReady = needed.length > 0 && needed.every((id) => readySet.has(id));
  const isLast = r.index + 1 >= r.total;

  const submitTeachBack = (withText) => {
    if (tbSent) return;
    setTbSent(true);
    sounds.teach();
    actions.submitTeachBack(withText ? tbText : "");
  };

  const markReady = () => {
    sounds.ready();
    actions.readyNext();
  };

  // picks grouped per option letter
  const letters = q ? Object.keys(q.options) : ["A", "B", "C", "D"];
  const optionText = (letter) => q?.options?.[letter] || "";

  return (
    <div className="lq-view">
      <p className="lq-reveal-header">
        QUESTION {r.index + 1} OF {r.total} · {r.numCorrect} OF {participants.filter((p) => p.connected).length} GOT IT
      </p>
      {q && <p className="lq-q-text" style={{ fontSize: 16, marginBottom: 20 }}>{q.question}</p>}

      <div className="lq-reveal-options">
        {letters.map((letter) => {
          const isCorrect = letter === r.correct;
          const whoPicked = Object.entries(r.picks).filter(([, a]) => a.option === letter);
          const stateClass = isCorrect ? "correct" : whoPicked.length > 0 ? "wrong" : "";
          return (
            <div key={letter} className={`lq-reveal-option ${stateClass}`}>
              <span className="lq-option-chip">{letter}</span>
              <p className="lq-option-text" style={{ margin: 0 }}>{optionText(letter)}</p>
              {isCorrect && <IconCheck size={16} style={{ color: "#3DD68C", marginRight: 4 }} />}
              {!isCorrect && whoPicked.length > 0 && <IconX size={14} style={{ color: "#FF6B5E", marginRight: 4 }} />}
              {whoPicked.length > 0 && (
                <div className="lq-picks">
                  <div className="lq-picks-avatars">
                    {whoPicked.map(([uid, a]) => {
                      const p = byId[uid];
                      return (
                        <span key={uid} className="lq-pick-avatar" style={{ background: p?.color || "#555" }}>
                          {initials(p?.username)}
                          {a.confidence && (
                            <span className="lq-conf-dot" style={{ background: confColor(a.confidence) }} />
                          )}
                        </span>
                      );
                    })}
                  </div>
                  <p className="lq-picks-label">
                    {whoPicked
                      .map(([uid, a]) => `${uid === myId ? "You" : byId[uid]?.username}${a.confidence ? `: ${a.confidence}` : ""}`)
                      .join(" · ")}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {r.explanation ? (
        <div className="lq-explain">
          <p className="lq-explain-title">WHY {r.correct}</p>
          <p className="lq-explain-text">{r.explanation}</p>
          <p style={{ fontSize: 11, color: "#6B7280", marginTop: 8, marginBottom: 0 }}>
            {myPick
              ? <>You answered with <strong style={{ color: confColor(myPick.confidence) }}>{myPick.confidence}</strong> confidence.</>
              : "You ran out of time."}
          </p>
        </div>
      ) : null}

      {/* Teach-back composer (I was the only correct one) */}
      {iAmTeacher && !tbSent && (
        <div className="lq-teachback">
          <p className="lq-ready-text" style={{ color: "#3DD68C" }}>Teach Back Time!</p>
          <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", margin: 0 }}>
            You got it right! Explain to the group why.
          </p>
          <textarea
            className="lq-tb-input"
            placeholder="Type your explanation…"
            value={tbText}
            onChange={(e) => setTbText(e.target.value)}
            maxLength={1000}
          />
          <button
            className="lq-btn-primary"
            style={{ background: "#3DD68C", color: "#0A0C10" }}
            disabled={tbText.trim().length < 5}
            onClick={() => submitTeachBack(true)}
          >
            Submit Explanation (+50 XP)
          </button>
          <button className="lq-btn-secondary" onClick={() => submitTeachBack(false)}>Skip</button>
        </div>
      )}

      {/* Waiting on someone else's teach-back */}
      {teacherWaiting && !room.teachBack?.text && (
        <div className="lq-teachback" style={{ background: "rgba(255,107,94,0.05)", borderColor: "rgba(255,107,94,0.2)" }}>
          <p className="lq-ready-text" style={{ color: "#FF6B5E" }}>Teach Back Time!</p>
          <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", margin: 0 }}>
            {teacher?.username} got it right. Waiting for their explanation…
          </p>
        </div>
      )}

      {/* Submitted teach-back text */}
      {room.teachBack?.text && (
        <div className="lq-teach-explain">
          <p className="lq-teach-explain-title">
            {room.teachBack.teacherId === myId ? "YOUR EXPLANATION" : `${(room.teachBack.teacherName || "").toUpperCase()}'S EXPLANATION`}
          </p>
          <p className="lq-teach-explain-text">"{room.teachBack.text}"</p>
        </div>
      )}

      {/* Ready check — visible once reveal is settled (not while I'm composing teach-back) */}
      {(room.phase === "reveal" || teacherWaiting || tbSent || room.teachBack?.skipped) && (
        <div className="lq-action-group">
          <div className="lq-ready-box">
            <p className="lq-ready-text">
              {allReady ? "Everyone is ready!" : "Waiting for everyone to be ready…"}
            </p>
            <div className="lq-ready-group">
              {participants.filter((p) => p.connected).map((p) => (
                <div
                  key={p.userId}
                  className={`lq-ready-avatar${readySet.has(p.userId) ? " is-ready" : ""}`}
                  style={{ background: p.color }}
                  title={p.username}
                >
                  {initials(p.username)}
                </div>
              ))}
            </div>
          </div>
          <button
            className={`lq-btn-primary${iAmReady ? " loading" : ""}`}
            onClick={markReady}
            disabled={iAmReady}
          >
            {iAmReady ? "Waiting for others…" : isLast ? "Ready to view results" : "Ready for next question"}
          </button>
        </div>
      )}
    </div>
  );
}
