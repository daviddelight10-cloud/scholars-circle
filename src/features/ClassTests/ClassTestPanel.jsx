import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { classTestApi, testPhase, fmtWindow, shareUrl } from "./classTestApi.js";
import { classroomApi } from "../Classroom/classroomApi.js";
import { CreateTestSheet } from "./CreateTestSheet.jsx";
import { TestRunner } from "./TestRunner.jsx";
import { TestResults } from "./TestResults.jsx";
import "./classTests.css";

/**
 * Class tests (CBT) inside a classroom.
 * Lecturer (isHost): create tests from the question bank, publish, share, clone, see results.
 * Student: see open tests, sit them once, see own score + post-close review when released.
 */
export function ClassTestPanel({ classroomId, isHost, token, subjects = [], classrooms = null, classroomName = "", me = null }) {
  const [tests, setTests] = useState(null);
  const [error, setError] = useState(null);
  const [view, setView] = useState({ name: "list" }); // list | create | run | results
  const [busy, setBusy] = useState(null); // test id being toggled/deleted
  const [shareSheet, setShareSheet] = useState(null); // test being shared
  const [cloneSheet, setCloneSheet] = useState(null); // test being cloned
  const [ownedClasses, setOwnedClasses] = useState(classrooms); // clone targets, lazy-loaded
  const [codeEntry, setCodeEntry] = useState({ open: false, code: "", err: null, busy: false });
  const navigate = useNavigate();

  // Clone targets: owned classrooms. Loaded lazily when the sheet opens.
  useEffect(() => {
    if (!cloneSheet || ownedClasses) return;
    classroomApi.my(token)
      // /classroom/my is already owned-only for staff; filter anyway as a guard.
      .then((d) => setOwnedClasses((Array.isArray(d) ? d : d.classrooms || []).filter((c) => !me?.id || c.createdById === me.id)))
      .catch(() => setOwnedClasses([]));
  }, [cloneSheet, ownedClasses, token, me?.id]);
  const cloneTargets = ownedClasses || [];

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

  const toggleAnswers = async (t) => {
    setBusy(t.id);
    try { await classTestApi.update(t.id, { showAnswers: !t.showAnswers }, token); load(); }
    catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  const toggleShare = async (t) => {
    setBusy(t.id);
    try {
      const d = await classTestApi.share(t.id, !t.shareEnabled, token);
      const merged = { ...t, shareEnabled: d.shareEnabled, shareToken: d.shareToken, shareCode: d.shareCode };
      load();
      if (d.shareEnabled) setShareSheet(merged);
    }
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

  const doClone = async (t, targetId) => {
    setBusy(t.id);
    try {
      await classTestApi.clone(t.id, targetId, token);
      setCloneSheet(null);
      alert(`"${t.title}" copied — it now lives in the other class's test list.`);
    } catch (e) { alert(e.message); }
    finally { setBusy(null); }
  };

  const copy = (text) => {
    try { navigator.clipboard.writeText(text); } catch {}
  };

  // Student: enter a lecturer's 6-letter share code → land on the shared test.
  const joinByCode = async () => {
    const code = codeEntry.code.trim().toUpperCase();
    if (code.length !== 6) { setCodeEntry((c) => ({ ...c, err: "Codes are 6 letters/numbers" })); return; }
    setCodeEntry((c) => ({ ...c, busy: true, err: null }));
    try {
      const d = await classTestApi.shareByCode(code, token);
      navigate(`/t/${d.token}`);
    } catch (e) {
      setCodeEntry((c) => ({ ...c, busy: false, err: e.message }));
    }
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
        me={me}
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
      {!isHost && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
          <button className="ct-btn ghost small" onClick={() => setCodeEntry((c) => ({ ...c, open: !c.open, err: null }))}>Have a test code?</button>
        </div>
      )}
      {codeEntry.open && !isHost && (
        <div className="ct-share-row" style={{ marginBottom: 10 }}>
          <input
            className="ct-input" placeholder="6-letter code" maxLength={6}
            value={codeEntry.code} autoCapitalize="characters"
            onChange={(e) => setCodeEntry((c) => ({ ...c, code: e.target.value.toUpperCase() }))}
            onKeyDown={(e) => { if (e.key === "Enter") joinByCode(); }}
          />
          <button className="ct-btn small" disabled={codeEntry.busy} onClick={joinByCode}>{codeEntry.busy ? "…" : "Go →"}</button>
        </div>
      )}
      {codeEntry.err && !isHost && <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>{codeEntry.err}</div>}
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
                    {isHost && t.shareEnabled && <span className="ct-chip upcoming" title="Share link is live">🔗 shared</span>}
                    {isHost && t.showAnswers && <span className="ct-chip done" title="Students can review answers after close">review on</span>}
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
                      <button className="ct-btn ghost small" disabled={busy === t.id} onClick={() => toggleShare(t)} title="Share link for anyone">
                        {t.shareEnabled ? "🔗" : "Share"}
                      </button>
                      <button className="ct-btn ghost small" disabled={busy === t.id} onClick={() => setCloneSheet(t)} title="Copy to another class">⧉</button>
                      <button className="ct-btn ghost small" disabled={busy === t.id} onClick={() => toggleAnswers(t)} title="Let students review answers after close">
                        {t.showAnswers ? "Hide rev" : "Review"}
                      </button>
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

      {/* Share sheet */}
      {shareSheet && (
        <div className="modal-overlay" onClick={() => setShareSheet(null)}>
          <div className="cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">Share "{shareSheet.title}"</h3>
            <p style={{ fontSize: 12, color: "var(--app-dim)", marginBottom: 12 }}>
              Anyone signed in with this link or code can sit the test. They show up flagged as guests in your results — class members stay members.
            </p>
            <div className="ct-share-row">
              <input className="ct-input" readOnly value={shareUrl(shareSheet.shareToken)} onFocus={(e) => e.target.select()} />
              <button className="ct-btn small" onClick={() => copy(shareUrl(shareSheet.shareToken))}>Copy</button>
            </div>
            <div className="ct-share-row">
              <div className="ct-share-code">{shareSheet.shareCode || "——"}</div>
              <button className="ct-btn ghost small" onClick={() => copy(shareSheet.shareCode)}>Copy code</button>
            </div>
            <p style={{ fontSize: 11, color: "var(--app-dim)", marginTop: 8 }}>
              Students can also enter this 6-letter code on their test list to join.
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button
                className="ct-btn danger small" style={{ flex: 1 }}
                onClick={async () => { await toggleShare(shareSheet); setShareSheet(null); }}
              >Turn off sharing</button>
              <button className="ct-btn" style={{ flex: 1 }} onClick={() => setShareSheet(null)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {/* Clone sheet */}
      {cloneSheet && (
        <div className="modal-overlay" onClick={() => setCloneSheet(null)}>
          <div className="cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">Copy "{cloneSheet.title}" to…</h3>
            <p style={{ fontSize: 12, color: "var(--app-dim)", marginBottom: 12 }}>
              Same questions, same settings. Adjust the window afterwards in the other class.
            </p>
            <div className="ct-list">
              {!ownedClasses && <div className="ct-empty-sub" style={{ padding: 12 }}>Loading your classes…</div>}
              {cloneTargets.filter((c) => c.id !== classroomId).map((c) => (
                <button
                  key={c.id}
                  className="ct-card ct-card-btn"
                  disabled={busy === cloneSheet.id}
                  onClick={() => doClone(cloneSheet, c.id)}
                >
                  <div className="ct-card-main">
                    <div className="ct-card-title">{c.name}</div>
                    <div className="ct-card-meta">{c._count?.members ?? c.memberCount ?? ""} members</div>
                  </div>
                  <span className="ct-btn ghost small">Copy →</span>
                </button>
              ))}
              {ownedClasses && cloneTargets.filter((c) => c.id !== classroomId).length === 0 && (
                <div className="ct-empty-sub" style={{ padding: 12 }}>You only own this class — create another class first.</div>
              )}
            </div>
            <button className="ct-btn ghost" style={{ width: "100%", marginTop: 12 }} onClick={() => setCloneSheet(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
