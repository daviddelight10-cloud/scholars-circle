import { useMemo, useState, useCallback } from "react";

/**
 * QuickQuiz — instant locally-generated MCQ quiz over a drug/lab pool.
 * No AI, works offline. Questions are templated from the item's own data,
 * with distractors sampled from sibling items in the same pool.
 *
 *   <QuickQuiz title="💊 Quiz: Amoxicillin"
 *              questions={drugQuestions(drug, DRUGS)}
 *              onClose={() => setQuiz(null)} />
 */

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickDistractors(pool, correct, n, key) {
  const seen = new Set([correct]);
  const out = [];
  for (const x of shuffle(pool)) {
    const v = typeof key === "function" ? key(x) : x;
    if (v && !seen.has(v)) {
      seen.add(v);
      out.push(v);
      if (out.length >= n) break;
    }
  }
  return out;
}

function mkQ(q, correct, distractors, explain) {
  const options = shuffle([correct, ...distractors.slice(0, 3)]);
  return { q, options, answer: options.indexOf(correct), explain };
}

function short(text, max = 90) {
  if (!text) return "";
  const t = String(text).split(";")[0].split(",")[0].trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Build ~5 questions for one drug. */
export function drugQuestions(drug, pool) {
  const qs = [];
  const others = pool.filter((d) => d.name !== drug.name);
  if (drug.class) {
    qs.push(
      mkQ(
        `Which class does ${drug.name} belong to?`,
        drug.class,
        pickDistractors(others, drug.class, 3, (d) => d.class),
        `${drug.name} (${drug.generic}) is a ${drug.class}.`
      )
    );
  }
  if (drug.contraindications) {
    qs.push(
      mkQ(
        `Which is a key contraindication/caution for ${drug.name}?`,
        short(drug.contraindications, 70),
        pickDistractors(others, short(drug.contraindications, 70), 3, (d) =>
          short(d.contraindications, 70)
        ),
        drug.contraindications
      )
    );
  }
  if (drug.indications) {
    qs.push(
      mkQ(
        `${drug.name} is indicated for:`,
        short(drug.indications, 70),
        pickDistractors(others, short(drug.indications, 70), 3, (d) =>
          short(d.indications, 70)
        ),
        drug.indications
      )
    );
  }
  if (drug.monitor && drug.monitor !== "—") {
    qs.push(
      mkQ(
        `Which monitoring/precaution is most relevant for ${drug.name}?`,
        short(drug.monitor, 80),
        pickDistractors(
          others.filter((d) => d.monitor && d.monitor !== "—"),
          short(drug.monitor, 80),
          3,
          (d) => short(d.monitor, 80)
        ),
        drug.monitor
      )
    );
  }
  if (drug.interactions) {
    qs.push(
      mkQ(
        `Which interaction is documented for ${drug.name}?`,
        short(drug.interactions, 80),
        pickDistractors(others, short(drug.interactions, 80), 3, (d) =>
          short(d.interactions, 80)
        ),
        drug.interactions
      )
    );
  }
  return shuffle(qs).slice(0, 5);
}

/** Build ~6 questions from a set of labs (random subset). */
export function labQuestions(labs) {
  const qs = [];
  const pool = shuffle(labs).slice(0, 6);
  for (const lab of pool) {
    const others = labs.filter((l) => l.parameter !== lab.parameter);
    const type = Math.floor(Math.random() * 3);
    if (type === 0 && lab.male) {
      const correct = `${lab.male} ${lab.unit}`.trim();
      qs.push(
        mkQ(
          `Reference range for ${lab.parameter}?`,
          correct,
          pickDistractors(others, correct, 3, (l) => `${l.male} ${l.unit}`.trim()),
          `${lab.parameter}: ${lab.male} ${lab.unit}`
        )
      );
    } else if (type === 1 && lab.unit) {
      qs.push(
        mkQ(
          `Which unit is ${lab.parameter} reported in?`,
          lab.unit,
          pickDistractors(others, lab.unit, 3, (l) => l.unit),
          `${lab.parameter} is reported in ${lab.unit}.`
        )
      );
    } else if (lab.high) {
      qs.push(
        mkQ(
          `A HIGH ${lab.parameter} is most consistent with:`,
          short(lab.high, 80),
          pickDistractors(
            others.filter((l) => l.high),
            short(lab.high, 80),
            3,
            (l) => short(l.high, 80)
          ),
          lab.high
        )
      );
    }
  }
  return qs.filter(Boolean).slice(0, 6);
}

/** Quiz overlay — renders question, options, feedback, score. */
export default function QuickQuiz({ title, subtitle, questions, onClose }) {
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const qs = useMemo(() => questions || [], [questions]);
  const q = qs[i];

  const pick = useCallback(
    (idx) => {
      if (picked !== null) return;
      setPicked(idx);
      if (idx === q.answer) setScore((s) => s + 1);
    },
    [picked, q]
  );

  const next = () => {
    if (i + 1 >= qs.length) setDone(true);
    else {
      setI((x) => x + 1);
      setPicked(null);
    }
  };

  return (
    <div className="cr-quiz-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cr-quiz">
        <div className="cr-quiz-head">
          <div>
            <div className="cr-quiz-title">{title}</div>
            {subtitle && <div className="cr-quiz-sub">{subtitle}</div>}
          </div>
          <button type="button" className="cr-icon-btn" onClick={onClose} aria-label="Close quiz">
            ✕
          </button>
        </div>

        {!q || done ? (
          <div className="cr-quiz-done">
            <div className="cr-quiz-score">
              {score}/{qs.length}
            </div>
            <p className="cr-muted">
              {score === qs.length
                ? "Perfect — clinical memory on point."
                : score >= qs.length * 0.7
                  ? "Strong — review the ones you missed."
                  : "Worth another pass — tap through the details again."}
            </p>
            <button type="button" className="cr-btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="cr-quiz-progress">
              Question {i + 1} / {qs.length}
              <div className="cr-quiz-track">
                <div className="cr-quiz-fill" style={{ width: `${(i / qs.length) * 100}%` }} />
              </div>
            </div>
            <div className="cr-quiz-q">{q.q}</div>
            <div className="cr-quiz-opts">
              {q.options.map((opt, idx) => {
                let cls = "cr-quiz-opt";
                if (picked !== null) {
                  if (idx === q.answer) cls += " correct";
                  else if (idx === picked) cls += " wrong";
                  else cls += " dim";
                }
                return (
                  <button
                    type="button"
                    key={idx}
                    className={cls}
                    onClick={() => pick(idx)}
                    disabled={picked !== null}
                  >
                    <span className="cr-quiz-opt-letter">{String.fromCharCode(65 + idx)}</span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
            {picked !== null && (
              <div className={`cr-quiz-explain ${picked === q.answer ? "good" : "bad"}`}>
                <strong>{picked === q.answer ? "Correct." : "Not quite."}</strong> {q.explain}
                <button type="button" className="cr-btn-primary cr-quiz-next" onClick={next}>
                  {i + 1 >= qs.length ? "See score" : "Next →"}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
