import { useState, useRef, useCallback } from 'react';
import { callAI } from '../../lib/aiClient.js';
import { deriveRating, rateQuestion, masteryDots } from './fsrsBridge.js';
import './streakSurvival.css';

const GRADE_LABEL = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
const GRADE_COLOR = { 1: '#FF5E7E', 2: '#FFB627', 3: '#4ADE80', 4: '#00E5FF' };

// Embeddable practice-mode MCQ card. Used inside DailyReview for mcq items.
// Props:
//   question   — normalized { q, opts[], a, hint, explanation, _resourceId, _pageIndex }
//   cardState  — optional server FSRS state for the mastery ring
//   onRated    — ({ grade, correct, xpAwarded, streak, longestStreak, intervalLabel }) after server ack (or immediately if offline)
//   onNext     — advance to next item
//   badge      — optional label like "MISSED — TRY AGAIN" (review loop)
export default function PracticeMcqCard({ question, cardState, onRated, onNext, badge }) {
  const [locked, setLocked] = useState(false);
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [eliminated, setEliminated] = useState(new Set());
  const [fsrsNote, setFsrsNote] = useState(null); // { grade, intervalLabel }
  const [explain, setExplain] = useState({ show: false, text: '', loading: false });
  const startRef = useRef(Date.now());
  const ratedRef = useRef(false);

  const handleHint = useCallback(() => {
    if (locked) return;
    setHintUsed(true);
    const wrongKeys = question.opts.map((_, i) => i).filter((i) => i !== question.a && !eliminated.has(i));
    if (wrongKeys.length <= 1) return;
    const target = wrongKeys[Math.floor(Math.random() * wrongKeys.length)];
    setEliminated((prev) => new Set(prev).add(target));
  }, [locked, question, eliminated]);

  const fireRating = useCallback((correct, rev) => {
    const grade = deriveRating({
      correct,
      revealed: rev,
      hintUsed,
      elapsedMs: Date.now() - startRef.current,
    });
    // Optimistic: report the grade immediately so callers can count/advance
    // without waiting on the network; refine the note when the server responds.
    setFsrsNote({ grade, intervalLabel: null });
    ratedRef.current = true;
    if (onRated) onRated({ grade, correct });
    rateQuestion({
      resourceId: question._resourceId,
      pageIndex: question._pageIndex,
      grade,
      itemType: question._itemType || 'mcq',
    }).then((data) => {
      if (!data) return;
      if (data.intervalLabel) setFsrsNote({ grade, intervalLabel: data.intervalLabel });
      if (onRated) {
        onRated({
          grade,
          correct,
          xpAwarded: data.xpAwarded || 0,
          streak: data.streak,
          longestStreak: data.longestStreak,
          intervalLabel: data.intervalLabel,
          serverAck: true,
        });
      }
    });
  }, [question, hintUsed, onRated]);

  const handlePick = useCallback((i) => {
    if (locked || eliminated.has(i)) return;
    setSelected(i);
    setLocked(true);
    fireRating(i === question.a, false);
  }, [locked, eliminated, question, fireRating]);

  const handleReveal = useCallback(() => {
    if (locked) return;
    setRevealed(true);
    setLocked(true);
    fireRating(false, true);
  }, [locked, fireRating]);

  const handleExplain = useCallback(async () => {
    setExplain({ show: true, text: '', loading: true });
    try {
      const optionsStr = question.opts.map((v, i) => `${String.fromCharCode(65 + i)}. ${v}`).join('\n');
      const correctAnswer = question.opts[question.a];
      const userAnswer = selected != null ? question.opts[selected] : '(revealed)';
      const prompt = `You are a helpful study tutor. A student just answered this MCQ question:\n\nQuestion: ${question.q}\nOptions:\n${optionsStr}\nCorrect answer: ${correctAnswer}\nStudent's answer: ${userAnswer}\n\nGive a clear, concise explanation (2-3 sentences) of why the correct answer is right. Be educational and encouraging.`;
      const text = await callAI(prompt, { provider: 'openrouter' });
      setExplain({ show: true, text: text || 'No explanation generated.', loading: false });
    } catch {
      setExplain({ show: true, text: 'Could not get AI explanation. Please try again.', loading: false });
    }
  }, [question, selected]);

  const ring = masteryDots(cardState);

  return (
    <div className="ss-root">
      <div className="qcard" style={{ padding: 20 }}>
        {badge && <span className="review-tag">{badge}</span>}
        <div className="qcard-head">
          <span className="difficulty-tag">Review</span>
          <span className="mastery-ring">
            {ring.due && <span className="due-flag">⏰</span>}
            {ring.mastered ? '🌟' : (
              <>
                <span className={`mrdot${ring.dots >= 1 ? ' on' : ''}`} />
                <span className={`mrdot${ring.dots >= 2 ? ' on' : ''}`} />
                <span className={`mrdot${ring.dots >= 3 ? ' on' : ''}`} />
              </>
            )}
          </span>
        </div>

        <div className="qtext">{question.q}</div>

        {hintUsed && (
          <div className="hint-box show">💡 {question.hint || 'One wrong option eliminated.'}</div>
        )}

        <div className="options">
          {question.opts.map((opt, i) => {
            let cls = 'opt';
            if (eliminated.has(i)) cls += ' eliminated';
            if (locked) {
              if (i === question.a) cls += ' correct';
              else if (i === selected) cls += ' wrong picked-wrong';
            }
            return (
              <button
                key={i}
                className={cls}
                disabled={locked || eliminated.has(i)}
                onClick={() => handlePick(i)}
              >
                <span className="ltr">{String.fromCharCode(65 + i)}</span>
                {opt}
              </button>
            );
          })}
        </div>

        {fsrsNote && (
          <div className="fsrs-note show" style={{ color: GRADE_COLOR[fsrsNote.grade] }}>
            🧠 {GRADE_LABEL[fsrsNote.grade]}
            {fsrsNote.intervalLabel ? ` · next review in ${fsrsNote.intervalLabel}` : ''}
          </div>
        )}

        {!locked && (
          <div className="card-actions">
            <button type="button" onClick={handleHint}>💡 Hint</button>
            <button type="button" onClick={handleReveal}>👁 Reveal</button>
          </div>
        )}

        {explain.show && (
          <div className="explain-box show">
            <span className="explain-label">AI Explain</span>
            {explain.loading ? <span className="dot-loading">Thinking</span> : explain.text}
          </div>
        )}

        {locked && (
          <div className="post-actions show">
            <button
              type="button"
              className="btn-explain"
              onClick={handleExplain}
              disabled={explain.loading}
            >
              ✨ Explain
            </button>
            <button type="button" className="btn-continue" onClick={onNext}>
              Continue →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
