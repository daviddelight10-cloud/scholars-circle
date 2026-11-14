import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getChallenge, takeChallenge, getLeaderboard } from "./examApi";
import { fmtDeadline as fmtLeft, fmtDuration as fmtDur, challengeUrl, canTakeChallenge } from "./challengeUtils";
import ExamRunner from "./ExamRunner";
import "./exam.css";

const authData = () => {
  try { return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}"); } catch { return {}; }
};

/**
 * /exam/:token — public landing for an exam challenge. Guests see the meta
 * and get a login gate; signed-in users take the exam in the shared runner.
 * Creators get a live taker strip + question-level stats.
 */
export default function ExamChallengePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const authed = !!authData().authToken;

  const [meta, setMeta] = useState(null);
  const [board, setBoard] = useState(null); // leaderboard payload (authed only)
  const [error, setError] = useState("");
  const [taking, setTaking] = useState(null); // takeChallenge response
  const [takeBusy, setTakeBusy] = useState(false);
  const [alreadyTaken, setAlreadyTaken] = useState(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const m = await getChallenge(token);
      setMeta(m);
      if (authData().authToken) {
        getLeaderboard(token).then(setBoard).catch(() => {});
      }
    } catch (e) {
      setError(e.status === 404 ? "This challenge doesn't exist — the link may be wrong or it was cancelled." : e.message);
    }
  }, [token]);

  useEffect(() => {
    load();
    return () => clearInterval(pollRef.current);
  }, [load]);

  // Creator live strip: poll the leaderboard while the page is open.
  useEffect(() => {
    if (!meta?.isCreator || !authed) return;
    pollRef.current = setInterval(() => {
      getLeaderboard(token).then(setBoard).catch(() => {});
      getChallenge(token).then(setMeta).catch(() => {});
    }, 15000);
    return () => clearInterval(pollRef.current);
  }, [meta?.isCreator, authed, token]);

  const startTake = async () => {
    if (!authed) { navigate(`/login?redirect=${encodeURIComponent(`/exam/${token}`)}`); return; }
    if (takeBusy) return;
    setTakeBusy(true);
    try {
      const t = await takeChallenge(token);
      setTaking(t);
    } catch (e) {
      if (e.status === 409 && e.data?.alreadyTaken) setAlreadyTaken(e.data.attempt || true);
      else if (e.status === 410) setMeta((m) => ({ ...m, closed: true }));
      else alert(e.message || "Couldn't start the exam");
    } finally {
      setTakeBusy(false);
    }
  };

  const backFromRunner = useCallback(() => {
    setTaking(null);
    load(); // refresh meta + board so the new rank shows
  }, [load]);

  // ── Taking the exam ─────────────────────────────────────────────────────
  if (taking) {
    return (
      <ExamRunner
        exam={taking.payload}
        examResourceId={taking.examResourceId}
        sourceTitle={taking.sourceTitle}
        challenge={{
          id: taking.challengeId,
          token,
          revealAt: taking.revealAt || null,
          scoring: taking.scoring,
        }}
        onBack={backFromRunner}
      />
    );
  }

  // ── Loading / error ─────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="exr-root exr-center">
        <div className="exr-resume-card">
          <div className="exr-resume-ic">🔒</div>
          <div className="exr-resume-title">Challenge unavailable</div>
          <p className="exr-resume-sub">{error}</p>
          <button className="exr-btn primary" onClick={() => navigate("/app")}>Go to the app</button>
        </div>
      </div>
    );
  }
  if (!meta) {
    return (
      <div className="exr-root exr-center">
        <div className="exr-spinner big" />
        <div className="exr-empty">Loading challenge…</div>
      </div>
    );
  }

  const { exam } = meta;
  const left = fmtLeft(meta.deadline);
  const myEntry = board?.mine || null;
  const entries = board?.entries || [];
  const top3 = entries.length ? entries.slice(0, 3) : meta.top3 || [];
  const canTake = canTakeChallenge(meta, meta.mine || (alreadyTaken ? { attempts: 1 } : null));
  const stats = meta.creatorStats || board?.creatorStats || null;

  return (
    <div className="exr-root exr-scroll">
      <div className="exr-results exc-page">
        {/* Landing card */}
        <div className="exr-score-card exc-hero">
          <div className="exr-cover-badge">🎓</div>
          <div className="exc-eyebrow">Exam challenge</div>
          <h1 className="exr-cover-title">{exam.name}</h1>
          <div className="exc-by">by {meta.creator.name}</div>
          <div className="exr-cover-meta">
            <span className="exr-chip">{exam.questionCount} questions</span>
            <span className="exr-chip">{exam.totalMarks} marks</span>
            <span className="exr-chip">{exam.timeLimitMin ? `${exam.timeLimitMin} min` : "Untimed"}</span>
            <span className="exr-chip">{meta.scoring === "first" ? "First attempt counts" : "Best score wins"}</span>
            {meta.reveal === "onClose" && <span className="exr-chip">🔒 Answers at close</span>}
          </div>
          <div className="exc-stats-row">
            <span>👥 {meta.taken} taken</span>
            {meta.topPct != null && <span>🏆 top {meta.topPct}%</span>}
            {left && <span className={left === "Ended" ? "exc-ended" : "exc-left"}>⏳ {left}</span>}
          </div>
        </div>

        {/* Your result / CTA */}
        {meta.mine ? (
          <div className="exc-your">
            <div className="exc-your-l">
              <b>Your result</b>
              <span>{meta.mine.bestPct}% · {meta.mine.attempts} attempt{meta.mine.attempts !== 1 ? "s" : ""}{myEntry ? ` · rank #${myEntry.rank}` : ""}</span>
            </div>
            {meta.scoring !== "first" && !meta.closed && (
              <button className="exr-btn primary" onClick={startTake} disabled={takeBusy}>
                {takeBusy ? "…" : "↻ Try again"}
              </button>
            )}
          </div>
        ) : (
          <button className="exr-btn primary big exc-take" onClick={startTake} disabled={takeBusy || !canTake}>
            {meta.closed ? "Challenge ended" : !authed ? "🔑 Log in to take it" : takeBusy ? "Preparing…" : "Take the exam →"}
          </button>
        )}
        {meta.closed && meta.mine == null && !authed && (
          <button className="exr-btn ghost" onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/exam/${token}`)}`)}>Log in to see the board</button>
        )}

        {/* Leaderboard */}
        <div className="exc-board">
          <div className="exc-board-head">
            <b>Leaderboard</b>
            <span>{entries.length || meta.taken} challenger{(entries.length || meta.taken) !== 1 ? "s" : ""}</span>
          </div>
          {!authed && !entries.length && top3.length === 0 && (
            <div className="exc-board-empty">No one has taken it yet — be the first.</div>
          )}
          {!authed && (meta.top3 || []).length === 0 && meta.taken === 0 && (
            <div className="exc-board-empty">Log in to see the full board.</div>
          )}
          {(entries.length ? entries : top3).map((e, i) => (
            <div key={e.userId || i} className={`exc-row${e.you ? " you" : ""}`}>
              <span className={`exc-rank${i < 3 ? " top" : ""}`}>{i < 3 ? ["🥇", "🥈", "🥉"][i] : `#${e.rank ?? i + 1}`}</span>
              <span className="exc-ava">{(e.avatar) ? <img src={e.avatar} alt="" /> : (e.name || "S")[0].toUpperCase()}</span>
              <span className="exc-name">{e.name}{e.you ? " (you)" : ""}{e.attempts > 1 ? ` · ${e.attempts} attempts` : ""}</span>
              <span className="exc-score">
                <b>{e.pct}%</b>
                {e.durationMs != null && <i>{fmtDur(e.durationMs)}</i>}
                {e.score != null && <i>{e.score}/{e.total}</i>}
              </span>
            </div>
          ))}
          {authed && !entries.length && <div className="exc-board-empty">No attempts yet — be the first on the board.</div>}
        </div>

        {/* Creator live strip + question stats */}
        {meta.isCreator && (
          <div className="exc-creator">
            <div className="exc-creator-row">
              <span>👀 {meta.viewed} viewed</span>
              <span>✍️ {meta.taken} taken</span>
              <span className="exc-live"><i /> live</span>
            </div>
            {stats && (
              <div className="exc-qstats">
                <div className="exc-board-head"><b>Question stats</b><span>avg {stats.avgPct}%</span></div>
                {stats.hardest?.map((q) => (
                  <div key={q.questionId} className="exc-qrow">
                    <span>Q{q.questionIndex + 1}</span>
                    <div className="exc-qbar"><i style={{ width: `${q.correctPct}%` }} /></div>
                    <b>{q.correctPct}%</b>
                  </div>
                ))}
                <div className="exc-qhint">Hardest questions by correct rate</div>
              </div>
            )}
          </div>
        )}

        {/* Share for creator */}
        {meta.isCreator && (
          <button
            className="exr-btn ghost"
            onClick={() => {
              navigator.clipboard?.writeText(challengeUrl(token)).catch(() => {});
            }}
          >
            🔗 Copy challenge link · code {meta.code}
          </button>
        )}
      </div>
    </div>
  );
}
