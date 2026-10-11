import { useEffect, useMemo, useState } from "react";
import { examFromResource, getExamAttempts } from "./examApi";
import { loadExamSession, QUESTION_TYPES } from "./examSchema";
import "./exam.css";

/**
 * Exam hub — the landing page for a saved exam. Shows the exam summary, your
 * attempt history, a primary retake action and a clearly-separated regenerate
 * option. Entered by tapping an exam card or the Practice Sheet's Exam sim tile.
 */
export default function ExamHub({ exam, source, onBack, onStart, onRegenerate, onBuild }) {
  const payload = exam ? examFromResource(exam) : null;
  const config = payload?.config || {};
  const questions = payload?.questions || [];
  const qCount = questions.length;
  const typeCounts = {};
  for (const q of questions) typeCounts[q.type] = (typeCounts[q.type] || 0) + 1;

  const [attempts, setAttempts] = useState(null);
  const [attemptsErr, setAttemptsErr] = useState(false);

  const savedSession = exam?.id ? loadExamSession(exam.id) : null;
  const answered = savedSession ? Object.keys(savedSession.answers || {}).length : 0;
  const sessionTotal = savedSession?.order?.length || qCount;

  useEffect(() => {
    if (!exam?.id) return;
    let cancelled = false;
    getExamAttempts(exam.id)
      .then((data) => { if (!cancelled) setAttempts(data?.attempts || []); })
      .catch(() => { if (!cancelled) setAttemptsErr(true); });
    return () => { cancelled = true; };
  }, [exam?.id]);

  const stats = useMemo(() => {
    if (!attempts?.length) return null;
    const best = attempts.reduce((m, a) => (a.total > 0 ? Math.max(m, a.score / a.total) : m), 0);
    return { best: Math.round(best * 100), count: attempts.length, last: attempts[0] };
  }, [attempts]);

  const timed = (config.timeLimitMin || 0) > 0;
  const modeLabel = config.mode === "practice" ? "Practice" : "Exam";
  const sourceTitle = source?.title || exam?.sourceTitle || null;

  // ── Empty state: no saved exam yet ────────────────────────────────────────
  if (!exam) {
    return (
      <div className="exr-root exr-scroll">
        <HubTop title="Exam" sub={sourceTitle || ""} onBack={onBack} />
        <div className="exr-results">
          <div className="exr-score-card exh-empty">
            <div className="exr-score-emoji">🎓</div>
            <div className="exr-score-title">No exam yet</div>
            <p className="exr-resume-sub">
              Build an AI exam from {sourceTitle ? `“${sourceTitle}”` : "this material"} — you pick
              the question count, types and timer, then retake it anytime.
            </p>
            {onBuild && (
              <button className="exr-btn primary big" onClick={onBuild}>Build an exam ✨</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="exr-root exr-scroll">
      <HubTop title={config.name || exam.title || "Exam"} sub={sourceTitle || "Saved exam"} onBack={onBack} />

      <div className="exr-results">
        {/* Exam summary card */}
        <div className="exr-score-card">
          <div className="exr-score-title">{config.name || exam.title || "Exam"}</div>
          <div className="exh-meta">
            <span>{qCount} question{qCount !== 1 ? "s" : ""}</span>
            <span>·</span>
            <span>{modeLabel} mode</span>
            <span>·</span>
            <span>{timed ? `${config.timeLimitMin} min` : "Untimed"}</span>
            {(config.passMarkPct || 0) > 0 && (
              <>
                <span>·</span>
                <span>Pass {config.passMarkPct}%</span>
              </>
            )}
          </div>
          {Object.keys(typeCounts).length > 0 && (
            <div className="exr-type-chips" style={{ marginTop: 10 }}>
              {Object.entries(typeCounts).map(([t, n]) => (
                <span key={t} className={`exr-chip t-${t}`}>{QUESTION_TYPES[t]?.icon} {n} {QUESTION_TYPES[t]?.label || t}</span>
              ))}
            </div>
          )}

          <div className="exr-score-grid" style={{ marginTop: 14 }}>
            <div className="exr-score-cell gold">
              <b>{stats ? `${stats.best}%` : "—"}</b>
              <span>Best score</span>
            </div>
            <div className="exr-score-cell">
              <b>{stats?.count ?? 0}</b>
              <span>Attempts</span>
            </div>
            <div className="exr-score-cell">
              <b>{stats?.last ? pct(stats.last) : "—"}</b>
              <span>Last attempt</span>
            </div>
          </div>
        </div>

        {/* Resume banner */}
        {savedSession && (
          <div className="exh-resume">
            <span>✍️</span>
            <div className="exh-resume-info">
              <b>Unfinished attempt</b>
              <span>{answered}/{sessionTotal} answered — the runner will offer to resume.</span>
            </div>
          </div>
        )}

        {/* Actions */}
        <button className="exr-btn primary big" onClick={onStart} disabled={!qCount}>
          {savedSession ? "Continue exam" : stats ? "Retake exam" : "Start exam"} →
        </button>

        {onRegenerate && (
          <button className="exh-regen" onClick={onRegenerate}>
            <span className="exh-regen-ic">✨</span>
            <div className="exh-regen-info">
              <b>Generate another exam</b>
              <span>New questions from the same source · uses AI</span>
            </div>
          </button>
        )}

        {/* Attempt history */}
        <div className="exh-section">Your attempts</div>
        {attemptsErr && <div className="exr-warn">⚠️ Couldn't load attempt history.</div>}
        {!attempts && !attemptsErr && <div className="exh-loading">Loading attempts…</div>}
        {attempts && attempts.length === 0 && (
          <div className="exh-none">No attempts yet — take the exam and your scores will show up here.</div>
        )}
        {attempts && attempts.length > 0 && (
          <div className="exh-attempts">
            {attempts.map((a, i) => {
              const best = stats && Math.round((a.score / (a.total || 1)) * 100) === stats.best;
              return (
                <div key={a.id || i} className="exh-attempt">
                  <div className="exh-attempt-date">{fmtDate(a.createdAt)}</div>
                  <div className="exh-attempt-score">
                    <b>{a.score}/{a.total}</b>
                    <span>{pct(a)}%</span>
                  </div>
                  <div className="exh-attempt-tags">
                    <span className={`exh-tag ${a.mode === "practice" ? "practice" : "exam"}`}>
                      {a.mode === "practice" ? "Practice" : "Exam"}
                    </span>
                    {best && <span className="exh-tag best">Best</span>}
                    {i === 0 && <span className="exh-tag latest">Latest</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function pct(a) {
  return a.total > 0 ? Math.round((a.score / a.total) * 100) : 0;
}

function fmtDate(d) {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      + " · " + new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function HubTop({ title, sub, onBack }) {
  return (
    <div className="exr-top">
      <div className="exr-top-left">
        <button className="exr-chip-btn" onClick={onBack}>← Back</button>
        <div className="exr-title">{title}</div>
        <div className="exr-sub">{sub}</div>
      </div>
    </div>
  );
}
