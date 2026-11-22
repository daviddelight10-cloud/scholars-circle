import { useCallback, useEffect, useRef, useState } from "react";
import { attendanceApi, getPosition } from "./attendanceApi.js";
import "./attendance.css";

export const ATTEND_LINK_KEY = "sc_attend_link";

// Read without consuming (StrictMode double-invokes initializers); cleared in an effect.
function readDeepLink() {
  try { return JSON.parse(sessionStorage.getItem(ATTEND_LINK_KEY) || "null"); } catch { return null; }
}

function MarkCard({ s, token, prefill, onDone }) {
  const [code, setCode] = useState(prefill || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(s.marked ? { verified: true } : null);
  const autoRan = useRef(false);

  const submit = useCallback(async (c) => {
    const value = String(c ?? code).trim();
    if (!/^\d{6}$/.test(value)) { setErr("Enter the 6-digit code on the lecturer's screen"); return; }
    setBusy(true);
    setErr("");
    try {
      let pos = null;
      if (s.needsLocation) {
        pos = await getPosition();
        if (!pos && s.locationRequired) throw new Error("Location is required for this session — allow location access and try again");
      }
      const r = await attendanceApi.mark(s.id, { code: value, ...(pos || {}) }, token);
      setResult({ verified: r.verified !== false });
      onDone?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }, [code, s, token, onDone]);

  // Scanned QR link: submit straight away when no location prompt is needed.
  useEffect(() => {
    if (autoRan.current || !prefill || s.marked || s.needsLocation) return;
    autoRan.current = true;
    submit(prefill);
  }, [prefill, s, submit]);

  return (
    <div className="att-card">
      <h3>{s.classroomName}</h3>
      <p className="att-sub">{s.title} · open until {new Date(s.closesAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
      {result ? (
        <div className="att-ok">
          ✓ You're marked present{result.verified ? "" : " (location not confirmed)"}
        </div>
      ) : (
        <>
          <div className="att-row">
            <input
              className="att-input att-code-entry"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <button className="att-btn" disabled={busy || code.length !== 6} onClick={() => submit()}>
              {busy ? "Marking…" : "Mark me present"}
            </button>
          </div>
          {s.needsLocation && <p className="att-muted" style={{ marginTop: 8 }}>This session checks you're in the lecture room — allow location when asked.</p>}
          {err && <p className="att-err">{err}</p>}
        </>
      )}
    </div>
  );
}

function History({ data }) {
  if (!data?.classrooms?.length) {
    return <div className="att-card att-muted">No attendance sessions yet. When a lecturer takes attendance in your class, your record shows up here.</div>;
  }
  return data.classrooms.map((c) => (
    <div key={c.classroomId} className="att-card">
      <div className="att-row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>{c.classroomName}</h3>
        <span className="att-rate" style={{ color: c.rate >= data.threshold ? "#34d399" : c.rate >= 50 ? "#fbbf24" : "#f87171" }}>{c.rate}%</span>
      </div>
      <p className="att-sub" style={{ marginTop: 4 }}>{c.attended} of {c.totalSessions} sessions · {data.threshold}% needed for exam eligibility</p>
      <div className="att-prog" title={`${c.rate}%`}><i style={{ width: `${c.rate}%` }} /></div>
      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
        {[...c.records].reverse().slice(0, 12).map((r) => (
          <div key={r.id} className="att-row" style={{ justifyContent: "space-between", fontSize: "0.82rem" }}>
            <span className="att-grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
            <span className="att-muted">{new Date(r.createdAt).toLocaleDateString()}</span>
            <span style={{ color: r.present ? "#34d399" : "#f87171", width: 18, textAlign: "right" }}>{r.present ? "✓" : "✗"}</span>
          </div>
        ))}
      </div>
    </div>
  ));
}

export default function StudentAttendance({ token, classroomId = null }) {
  const [active, setActive] = useState(null);
  const [mine, setMine] = useState(null);
  const [error, setError] = useState("");
  const [link] = useState(readDeepLink);

  useEffect(() => {
    try { sessionStorage.removeItem(ATTEND_LINK_KEY); } catch { /* noop */ }
  }, []);

  const load = useCallback(async () => {
    try {
      const [a, m] = await Promise.all([attendanceApi.active(token, classroomId), attendanceApi.mine(token, classroomId)]);
      setActive(a.sessions || []);
      setMine(m);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [token, classroomId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <div className="att">
      {error && <div className="att-card att-err" style={{ margin: 0 }}>{error}</div>}
      {active === null && !error && <div className="att-card att-muted">Loading…</div>}
      {active?.length === 0 && (
        <div className="att-card">
          <h3>No attendance open right now</h3>
          <p className="att-sub" style={{ margin: 0 }}>When your lecturer starts attendance, it appears here. You can also scan the QR code on their screen with your phone camera.</p>
        </div>
      )}
      {active?.map((s) => (
        <MarkCard key={s.id} s={s} token={token} prefill={link?.sid === s.id ? link.code : ""} onDone={load} />
      ))}
      <History data={mine} />
    </div>
  );
}
