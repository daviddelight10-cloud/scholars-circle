import { useState } from "react";
import { IconCheck, IconX } from "../icons.jsx";
import { sounds } from "../sounds";
import AvatarMark from "../../../components/AvatarMark.jsx";

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
  const iGotIt = myPick?.option === r.correct;
  const delta = r.pointsDelta?.[myId] || 0;
  const activeN = needed.length;
  const readyN = needed.filter((id) => readySet.has(id)).length;
  const revealTotalMs = (room.settings.revealSeconds || 10) * 1000;
  const leftMs = room.revealLeftMs;
  const leftPct = leftMs != null ? Math.max(0, Math.min(100, (leftMs / revealTotalMs) * 100)) : 0;

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
  const MAX_PICK_AVATARS = 12; // cap the avatar stack at scale — "+N" carries the rest
  const NAME_LIST_LIMIT = 8;  // beyond this, show a count instead of a name blob

  return (
    <div className="lq-view">
      <p className="lq-reveal-header">
        QUESTION {r.index + 1} OF {r.total} · {r.numCorrect} OF {participants.filter((p) => p.connected && !p.spectator).length} GOT IT
        {r.difficultyMult > 1 ? ` · HARD ×${r.difficultyMult}` : r.difficultyMult < 1 ? ` · EASY ×${r.difficultyMult}` : ""}
      </p>
      {q && <p className="lq-q-text" style={{ fontSize: 16, marginBottom: 20 }}>{q.question}</p>}

      {!room.mySpectator && !(room.isHost && room.presenterMode) && (
        <div className={`lq-result-banner ${myPick ? (iGotIt ? "ok" : "bad") : "late"}`} role="status">
          <b>{myPick ? (iGotIt ? "✓ Correct" : "✗ Not this one") : "⏱ Time's up"}</b>
          <span>
            {delta ? `${delta > 0 ? "+" : ""}${delta} pts` : "0 pts"}
            {r.points?.[myId] != null ? ` · ${r.points[myId]} total` : ""}
            {room.groupStreak > 1 ? ` · 🔥 group streak ${room.groupStreak}` : ""}
          </span>
        </div>
      )}

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
                    {whoPicked.slice(0, MAX_PICK_AVATARS).map(([uid, a]) => {
                      const p = byId[uid];
                      return (
                        <span key={uid} className="lq-pick-avatar" style={{ background: p?.avatar ? "transparent" : p?.color || "#555", border: p?.avatar ? "none" : undefined }}>
                          {p?.avatar ? <AvatarMark avatar={p.avatar} name={p.username} size={24} /> : initials(p?.username)}
                          {a.confidence && (
                            <span className="lq-conf-dot" style={{ background: confColor(a.confidence) }} />
                          )}
                        </span>
                      );
                    })}
                    {whoPicked.length > MAX_PICK_AVATARS && (
                      <span className="lq-pick-avatar lq-pick-more">+{whoPicked.length - MAX_PICK_AVATARS}</span>
                    )}
                  </div>
                  <p className="lq-picks-label">
                    {whoPicked.length > NAME_LIST_LIMIT
                      ? `${whoPicked.length} picked this`
                      : whoPicked
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
          <p style={{ fontSize: 11, color: "var(--app-dim)", marginTop: 8, marginBottom: 0 }}>
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
          <p style={{ fontSize: 12, color: "var(--app-dim)", textAlign: "center", margin: 0 }}>
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
          <p style={{ fontSize: 12, color: "var(--app-dim)", textAlign: "center", margin: 0 }}>
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

      {/* Auto-advance bar — sticky so "Next" is always on screen */}
      {(room.phase === "reveal" || teacherWaiting || tbSent || room.teachBack?.skipped) && (
        <div className="lq-nextbar">
          {leftMs != null && room.phase === "reveal" && (
            <div className="lq-nextbar-timer" aria-hidden="true"><span style={{ width: `${leftPct}%` }} /></div>
          )}
          <div className="lq-nextbar-row">
            <p className="lq-nextbar-text">
              {leftMs != null && room.phase === "reveal"
                ? `${isLast ? "Results" : "Next question"} in ${Math.ceil(leftMs / 1000)}s`
                : "Up next…"}
              <i>{readyN}/{activeN} ready</i>
            </p>
            {room.isHost && !allReady && (
              <button className="lq-nextbar-secondary" onClick={actions.forceAdvance}>Next now</button>
            )}
            <button
              className="lq-nextbar-btn"
              onClick={markReady}
              disabled={iAmReady || !!room.mySpectator}
            >
              {room.mySpectator ? "Watching" : iAmReady ? "Waiting…" : "Continue"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
