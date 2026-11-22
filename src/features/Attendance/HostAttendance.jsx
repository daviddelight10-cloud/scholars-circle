import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { STUDENT_APP_URL } from "../../faculty/env.js";
import { attendanceApi, getPosition } from "./attendanceApi.js";
import "./attendance.css";

const studentBase = () => (STUDENT_APP_URL.startsWith("http") ? STUDENT_APP_URL : `${window.location.origin}${STUDENT_APP_URL}`);

function StartForm({ classroomId, token, onStarted }) {
  const [title, setTitle] = useState("");
  const [mins, setMins] = useState(15);
  const [verify, setVerify] = useState(false);
  const [radius, setRadius] = useState(150);
  const [mode, setMode] = useState("flag");
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const toggleVerify = async (on) => {
    setVerify(on);
    setErr("");
    if (!on) return setPos(null);
    const p = await getPosition(10000);
    if (!p) { setVerify(false); setErr("Couldn't read your location — allow location access, or start without venue checking."); return; }
    setPos(p);
  };

  const start = async () => {
    setBusy(true);
    setErr("");
    try {
      const s = await attendanceApi.open(
        classroomId,
        { title, durationMins: mins, ...(verify && pos ? { geo: { lat: pos.lat, lng: pos.lng, radiusM: radius, mode } } : {}) },
        token
      );
      onStarted(s.id);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="att-card">
      <h3>Take attendance</h3>
      <p className="att-sub">Show the rotating code or QR in the hall. Students in this class enter it on their phones.</p>
      <div className="att-row" style={{ alignItems: "flex-end" }}>
        <label className="att-field att-grow">Title (optional)
          <input className="att-input" placeholder="e.g. CSC101 — Week 4" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </label>
        <label className="att-field">Open for
          <select className="att-select" value={mins} onChange={(e) => setMins(Number(e.target.value))}>
            {[10, 15, 30, 60, 120].map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
        </label>
      </div>
      <label className="att-check" style={{ marginTop: 10 }}>
        <input type="checkbox" checked={verify} onChange={(e) => toggleVerify(e.target.checked)} />
        Check students are in the room (uses my location as the venue)
      </label>
      {verify && pos && (
        <div className="att-row" style={{ marginTop: 8 }}>
          <label className="att-field">Radius
            <select className="att-select" value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
              {[75, 150, 300, 600].map((r) => <option key={r} value={r}>{r} m</option>)}
            </select>
          </label>
          <label className="att-field">If outside
            <select className="att-select" value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="flag">Mark but flag ⚠</option>
              <option value="require">Block them</option>
            </select>
          </label>
        </div>
      )}
      {err && <p className="att-err">{err}</p>}
      <div style={{ marginTop: 12 }}>
        <button className="att-btn" disabled={busy} onClick={start}>{busy ? "Starting…" : "Start attendance"}</button>
      </div>
    </div>
  );
}

function PresentScreen({ sessionId, classroomId, token, onClose }) {
  const [live, setLive] = useState(null);
  const [qr, setQr] = useState("");
  const [err, setErr] = useState("");

  const poll = useCallback(async () => {
    try {
      const d = await attendanceApi.live(sessionId, token);
      setLive(d);
      setErr("");
      if (d.status !== "open") onClose();
    } catch (e) {
      setErr(e.message);
    }
  }, [sessionId, token, onClose]);

  useEffect(() => {
    poll();
    const t = setInterval(poll, 3000);
    return () => clearInterval(t);
  }, [poll]);

  useEffect(() => {
    if (!live?.code) return;
    const url = `${studentBase()}?attend=${sessionId}&c=${live.code}&cr=${classroomId}`;
    QRCode.toDataURL(url, { margin: 1, width: 360, errorCorrectionLevel: "M" }).then(setQr).catch(() => setQr(""));
  }, [live?.code, sessionId, classroomId]);

  const end = async () => {
    try { await attendanceApi.close(sessionId, token); } catch { /* closed already */ }
    onClose();
  };

  const code = live?.code || "";
  return (
    <div className="att-present">
      <h2>{live?.title || "Attendance"}</h2>
      <div className="att-bigcode">{code ? `${code.slice(0, 3)} ${code.slice(3)}` : "···  ···"}</div>
      <div className="att-bar"><i style={{ width: `${live ? (live.secondsLeft / 30) * 100 : 0}%` }} /></div>
      {qr && <img className="att-qr" src={qr} alt="Attendance QR code" />}
      <div className="att-muted">Enter the code in Scholar's Circle → Attendance, or scan the QR with your camera</div>
      <div className="att-count">{live ? `${live.markedCount} / ${live.total} present` : "…"}</div>
      <div className="att-names">
        {live?.marks?.slice(0, 40).map((m) => (
          <span key={m.userId} className={`att-chip${m.verified ? "" : " warn"}`}>{m.verified ? "" : "⚠ "}{m.username}</span>
        ))}
      </div>
      {err && <p className="att-err">{err}</p>}
      <button className="att-btn danger" onClick={end}>End attendance</button>
    </div>
  );
}

function Report({ classroomId, token, refreshKey }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setData(await attendanceApi.report(classroomId, token)); setErr(""); } catch (e) { setErr(e.message); }
  }, [classroomId, token]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const toggle = async (sessionId, studentId, present) => {
    try { await attendanceApi.setMark(sessionId, studentId, !present, token); await load(); } catch (e) { setErr(e.message); }
  };

  const exportCSV = () => {
    const head = ["Matric No", "Name", "Username", ...data.sessions.map((s) => s.title), "Attended", "Rate %", `Eligible (${data.threshold}%)`];
    const rows = data.rows.map((r) => [
      r.student.matricNumber || "", r.student.fullName || "", r.student.username || "",
      ...r.cells.map((c) => (c.present ? "P" : "A")), r.attended, r.rate, r.eligible ? "Yes" : "No",
    ]);
    const csv = [head, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "attendance.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (err) return <div className="att-card att-err">{err}</div>;
  if (!data) return <div className="att-card att-muted">Loading report…</div>;
  if (data.totalSessions === 0) return <div className="att-card att-muted">No attendance taken yet. Start your first session above.</div>;

  return (
    <div className="att-card">
      <div className="att-row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: 0 }}>Attendance report</h3>
          <div className="att-muted">{data.rows.length} students · {data.totalSessions} sessions · tap a cell to correct it</div>
        </div>
        <button className="att-btn ghost" onClick={exportCSV}>Export CSV</button>
      </div>
      <div className="att-scroll">
        <table className="att-table">
          <thead>
            <tr>
              <th>Matric</th><th>Name</th>
              {data.sessions.map((s) => <th key={s.id} title={s.title}>{new Date(s.createdAt).toLocaleDateString([], { day: "numeric", month: "short" })}</th>)}
              <th>Rate</th><th>Eligible</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.student.id} className={r.eligible ? "" : "low"}>
                <td>{r.student.matricNumber || <span className="att-muted">—</span>}</td>
                <td>{r.student.fullName || r.student.username}</td>
                {r.cells.map((c, i) => (
                  <td key={i}>
                    <button
                      className={`att-cell${c.present ? (c.verified ? " on" : " warn") : ""}`}
                      title={c.present ? (c.verified ? "Present — tap to remove" : "Present, outside venue — tap to remove") : "Absent — tap to mark present"}
                      onClick={() => toggle(data.sessions[i].id, r.student.id, c.present)}
                    >
                      {c.present ? (c.verified ? "✓" : "⚠") : "·"}
                    </button>
                  </td>
                ))}
                <td className="att-rate" style={{ color: r.eligible ? "#34d399" : "#f87171" }}>{r.rate}%</td>
                <td>{r.eligible ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HostAttendance({ classroomId, token }) {
  const [sessionId, setSessionId] = useState(null);
  const [checked, setChecked] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let live = true;
    setChecked(false);
    setSessionId(null);
    attendanceApi.hostActive(classroomId, token)
      .then((d) => { if (live) setSessionId(d.session?.id || null); })
      .catch(() => {})
      .finally(() => { if (live) setChecked(true); });
    return () => { live = false; };
  }, [classroomId, token]);

  const onClosed = useCallback(() => { setSessionId(null); setRefreshKey((k) => k + 1); }, []);

  if (!checked) return <div className="att-card att-muted">Loading…</div>;

  return (
    <div className="att">
      {sessionId ? (
        <PresentScreen sessionId={sessionId} classroomId={classroomId} token={token} onClose={onClosed} />
      ) : (
        <StartForm classroomId={classroomId} token={token} onStarted={setSessionId} />
      )}
      <Report classroomId={classroomId} token={token} refreshKey={refreshKey} />
    </div>
  );
}
