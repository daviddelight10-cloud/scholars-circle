import { useCallback, useEffect, useState } from "react";
import { classTestApi, testPhase, fmtWindow } from "./classTestApi.js";
import { CreateTestSheet } from "./CreateTestSheet.jsx";
import { TestRunner } from "./TestRunner.jsx";
import { TestResults } from "./TestResults.jsx";
import "./classTests.css";

/**
 * Class tests (CBT) inside a classroom.
 * Lecturer (isHost): create tests from the question bank, publish, see results.
 * Student: see open tests, sit them once, see own score when allowed.
 */
export function ClassTestPanel({ classroomId, isHost, token, subjects = [], classroomName = "" }) {
  const [tests, setTests] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState({ name: "list" }); // list | create | run | results
  const [busy, setBusy] = useState(null); // test id being toggled/deleted

  const load = useCallback(() => {
    classTestApi.list(classroomId, token)
      .then((d) => { setTests(d.tests || []); setError(null); })
      .catch((e) => setError(e.message));
  }, [classroomId, token]);

  useEffect(() => { load(); }, [load]);

  const togglePublish = async (t) => {
    setBusy(t.id);
    try { await classTestApi.update(t.id, { published: !t.published }, token); load(); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete "${t.title}"? Results will be lost.`)) return;
    setBusy(t.id);
    try { await classTestApi.remove(t.id, token); load(); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  if (view.name === "create") {
    return (
      <CreateTestSheet
        classroomId={classroomId}
        token={token}
        subjects={subjects}
        onDone={() => { setView({ name: "list" }); load(); }}
        onCancel={() => setView({ name: "list" })}
      />
    );
  }
  if (view.name === "run") {
    return (
      <TestRunner
        test={view.test}
        token={token}
        onDone={() => { setView({ name: "list" }); load(); }}
      />
    );
  }
  if (view.name === "results") {
    return (
      <TestResults
        test={view.test}
        token={token}
        classroomName={classroomName}
        onBack={() => setView({ name: "list" })}
      />
    );
  }

  if (error) return <div className="ct-empty"><div className="ct-empty-title">Couldn't load tests</div><div className="ct-empty-sub">{error}</div></div>;
  if (!tests) return <div className="ct-empty"><div className="ct-empty-sub">Loading tests…</div></div>;

  const studentAction = (t) => {
    const phase = testPhase(t);
    if (t.myAttempt?.status === "submitted") {
      return (
        <button className="ct-btn ghost small" onClick={() => setView({ name: "run", test: t, review: true })}>
          {t.showScore && t.myAttempt.percent != null ? `${t.myAttempt.percent}%` : "Submitted ✓"}
        </button>
      );
    }
    if (phase === "open") {
      return (
        <button className="ct-btn small" onClick={() => setView({ name: "run", test: t })}>
          {t.myAttempt ? "Resume" : "Start"} →
        </button>
      );
    }
    if (phase === "upcoming") return <span className="ct-card-meta">Not open yet</span>;
    return <span className="ct-card-meta">Closed</span>;
  };

  return (
    <div>
      {isHost && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button className="ct-btn" onClick={() => setView({ name: "create" })}>＋ New class test</button>
        </div>
      )}
      {tests.length === 0 ? (
        <div className="ct-empty">
          <div className="ct-empty-ic">✍️</div>
          <div className="ct-empty-title">{isHost ? "No tests yet" : "No tests posted"}</div>
          <div className="ct-empty-sub">
            {isHost
              ? "Build a test from your question bank — students sit it in-app and it's marked automatically."
              : "When your lecturer posts a class test it will show here."}
          </div>
        </div>
      ) : (
        <div className="ct-list">
          {tests.map((t) => {
            const phase = testPhase(t);
            const chip = t.myAttempt?.status === "submitted" ? "done" : (!t.published ? "draft" : phase);
            return (
              <div key={t.id} className="ct-card">
                <div className="ct-card-main">
                  <div className="ct-card-title">
                    {t.title}{" "}
                    <span className={`ct-chip ${chip}`}>
                      {chip === "done" ? "Done" : chip === "draft" ? "Draft" : phase}
                    </span>
                  </div>
                  <div className="ct-card-meta">
                    {t.questionCount} questions · {t.durationMin} min · {fmtWindow(t)}
                    {isHost && ` · ${t.attemptCount} attempt${t.attemptCount === 1 ? "" : "s"}`}
                  </div>
                </div>
                <div className="ct-card-actions">
                  {isHost ? (
                    <>
                      <button className="ct-btn ghost small" onClick={() => setView({ name: "results", test: t })}>Results</button>
                      <button className="ct-btn ghost small" disabled={busy === t.id} onClick={() => togglePublish(t)}>
                        {t.published ? "Unpublish" : "Publish"}
                      </button>
                      <button className="ct-btn danger small" disabled={busy === t.id} onClick={() => remove(t)}>✕</button>
                    </>
                  ) : studentAction(t)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
