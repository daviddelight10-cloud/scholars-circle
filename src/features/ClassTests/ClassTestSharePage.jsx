import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { classTestApi, fmtWindow } from "./classTestApi.js";
import { TestRunner } from "./TestRunner.jsx";
import { ensureAppSession } from "../../lib/authToken.js";
import "./classTests.css";

const authData = () => {
  try { return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}"); } catch { return {}; }
};

/**
 * /t/:token — public landing for a shared class test. Guests see the paper
 * meta and get a login gate; signed-in users sit it in the same server-graded
 * runner (guest attempts are flagged in the lecturer's results).
 */
export default function ClassTestSharePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState(() => authData().authUser || null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [taking, setTaking] = useState(false);

  const load = useCallback(async () => {
    try {
      setMeta(await classTestApi.shareMeta(token));
    } catch (e) {
      setError(e.status === 404 ? "This shared test doesn't exist — the link may be wrong or sharing was turned off." : e.message);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Recover sessions for OAuth returns before treating them as guests.
  useEffect(() => {
    if (me) return;
    let live = true;
    ensureAppSession().then((u) => {
      if (!live) return;
      if (u) { setMe(u); load(); }
    });
    return () => { live = false; };
  }, [me, load]);

  const backFromRunner = useCallback(() => {
    setTaking(false);
    load();
  }, [load]);

  if (taking && meta) {
    return (
      <div className="app dark" style={{ minHeight: "100dvh", padding: "16px 16px 40px" }}>
        <TestRunner
          test={{ id: meta.testId, title: meta.title, instructions: meta.instructions, durationMin: meta.durationMin, questionCount: meta.questionCount, myAttempt: meta.mine, showScore: meta.showScore }}
          shareToken={token}
          me={me}
          onDone={backFromRunner}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cts-root">
        <div className="ctr-cover">
          <div className="ctr-cover-ic">🔒</div>
          <div className="ctr-cover-title">Link unavailable</div>
          <p className="ctr-cover-sub">{error}</p>
          <button className="ct-btn" onClick={() => navigate("/app")}>Go to the app</button>
        </div>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="cts-root">
        <div className="ctr-cover"><div className="ctr-cover-sub">Loading shared test…</div></div>
      </div>
    );
  }

  const closed = meta.phase === "closed";
  const upcoming = meta.phase === "upcoming";
  const submitted = meta.mine?.status === "submitted";

  return (
    <div className="cts-root">
      <div className="cts-card">
        <div className="ctr-cover-ic">✍️</div>
        <div className="cts-eyebrow">Class test · {meta.classroomName}</div>
        <h1 className="ctr-cover-title" style={{ fontSize: 22 }}>{meta.title}</h1>
        <div className="ctr-cover-meta">
          <span className="ct-chip upcoming">{meta.questionCount} questions</span>
          <span className="ct-chip upcoming">{meta.durationMin} min</span>
          <span className={`ct-chip ${meta.phase}`}>{meta.phase === "open" ? "Open now" : upcoming ? "Opens later" : "Closed"}</span>
        </div>
        <div className="ct-card-meta" style={{ textAlign: "center", marginBottom: 14 }}>{fmtWindow(meta)} · {meta.taken} taken</div>
        {meta.instructions && <p className="ctr-cover-sub" style={{ textAlign: "left", background: "rgba(255,255,255,.03)", padding: "10px 12px", borderRadius: 10 }}>{meta.instructions}</p>}

        {submitted ? (
          <div className="cts-submitted">
            <div style={{ fontSize: 13, fontWeight: 600 }}>✅ You've submitted this test</div>
            {meta.showScore && meta.mine?.percent != null && (
              <div className="ctr-score" style={{ fontSize: 36 }}>{meta.mine.percent}%</div>
            )}
            <button className="ct-btn ghost" style={{ marginTop: 12 }} onClick={() => navigate("/app")}>Open Scholar's Circle</button>
          </div>
        ) : closed ? (
          <div className="cts-submitted">
            <div className="ctr-cover-sub">This test has closed.</div>
            <button className="ct-btn ghost" onClick={() => navigate("/app")}>Open Scholar's Circle</button>
          </div>
        ) : (
          <button
            className="ct-btn cts-take"
            onClick={() => (me ? setTaking(true) : navigate(`/login?redirect=${encodeURIComponent(`/t/${token}`)}`))}
          >
            {!me ? "🔑 Log in to take it" : meta.mine ? "Resume attempt →" : "Take the test →"}
          </button>
        )}
        {upcoming && <div className="ct-card-meta" style={{ marginTop: 10 }}>Opens {new Date(meta.opensAt).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</div>}
        {!me && <div className="ct-card-meta" style={{ marginTop: 12 }}>Free account required — it takes a minute.</div>}
      </div>
    </div>
  );
}
