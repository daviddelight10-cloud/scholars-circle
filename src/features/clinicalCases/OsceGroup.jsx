import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useOsceRoom } from "./osceGroupClient.js";
import { callAIChat } from "../../lib/aiClient";
import { buildPatientPrompt } from "./patientPrompt.js";
import { invitesHiddenAgenda } from "./commMetrics.js";
import { CASES, EXAM_LABELS, INV_QUICK, STATION_TYPES } from "./caseData.js";
import { getCustomStations } from "./stationLibrary.js";
import ExitPill from "../../components/ExitPill.jsx";
import { useOverlayBackClose } from "../../hooks/useOverlayBackClose.js";

const ROLE_META = {
  candidate: { icon: "🩺", label: "Candidate", desc: "Takes the history & runs the station" },
  examiner: { icon: "📋", label: "Examiner", desc: "Ticks the checklist & gives the rating" },
  patient: { icon: "🎭", label: "Patient", desc: "Plays the patient from the script" },
  observer: { icon: "👀", label: "Observer", desc: "Watches the station" },
};

function fmtClock(msLeft) {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function OsceGroup({ onBack, aiConfig }) {
  // Device/browser back exits group practice instead of leaving the app.
  useOverlayBackClose(onBack, { open: !!onBack });

  const { room, connected, error, bellAt, createRoom, joinRoom, send, leave, setError } = useOsceRoom();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingStation, setPendingStation] = useState(null);
  const now = useNow();

  const myRole = room?.me?.role || "observer";
  const isHost = room && room.hostId === room.me?.userId;
  const msLeft = room?.timerEndsAt ? room.timerEndsAt - now : 0;
  const [bellFlash, setBellFlash] = useState(false);

  useEffect(() => {
    if (!bellAt) return;
    setBellFlash(true);
    const t = setTimeout(() => setBellFlash(false), 2200);
    return () => clearTimeout(t);
  }, [bellAt]);

  async function doCreate() {
    if (!pendingStation) { setPickerOpen(true); return; }
    setBusy(true);
    try { await createRoom(pendingStation); setPendingStation(null); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  async function doJoin() {
    if (!pin.trim()) return;
    setBusy(true);
    try { await joinRoom(pin.trim()); setPin(""); }
    catch (e) { setError(e.message); }
    setBusy(false);
  }

  function leaveRoom() {
    send({ type: "leave_room" }); // instant host-migration server-side
    leave();
  }

  /* ── HOME: create or join ─────────────────────────────────────────────── */
  if (!room) {
    return (
      <div className="vp-consult-screen">
      <div className="vp-consult-col" style={{ overflowY: "auto" }}>
        <ExitPill title="Group Practice" onBack={onBack} />
        <div className="vp-glass vp-og-home">
          <div className="vp-og-hero">
            <div className="vp-og-emoji">👥</div>
            <div className="vp-og-title">Group OSCE Practice</div>
            <div className="vp-og-sub">
              Run a real station with friends — one of you plays the patient, one the candidate,
              one marks the checklist live. Share the PIN to bring everyone in.
            </div>
          </div>

          {error && <div className="vp-voice-err" style={{ margin: "0 0 14px" }}>⚠ {error}</div>}

          <div className="vp-og-cards">
            <div className="vp-og-card">
              <div className="vp-og-card-t">Host a room</div>
              <div className="vp-og-card-s">Pick a station, get a PIN, assign roles.</div>
              <button className="vp-og-station-pick" onClick={() => setPickerOpen(true)}>
                {pendingStation ? `📄 ${pendingStation.title || pendingStation.cc}` : "Choose a station…"}
              </button>
              <button className="vp-cta-start" disabled={busy || !pendingStation} onClick={doCreate}>
                {busy ? "Creating…" : "Create room"}
              </button>
            </div>
            <div className="vp-og-card">
              <div className="vp-og-card-t">Join with PIN</div>
              <div className="vp-og-card-s">Got a code from a friend? Drop it here.</div>
              <input
                className="vp-og-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
              />
              <button className="vp-cta-start alt" disabled={busy || pin.length < 6} onClick={doJoin}>
                {busy ? "Joining…" : "Join room"}
              </button>
            </div>
          </div>
        </div>

        {pickerOpen && (
          <StationPicker
            onPick={(st) => { setPendingStation(st); setPickerOpen(false); }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </div>
      </div>
    );
  }

  /* ── ROOM ─────────────────────────────────────────────────────────────── */
  const st = room.station || {};
  const stationType = STATION_TYPES[st.station_type || "history"] || STATION_TYPES.history;

  return (
    <div className="vp-consult-screen">
    <div className="vp-consult-col" style={{ overflowY: "auto" }}>
      <div className="vp-glass vp-case-header">
        <div>
          <div className="vp-bed-tag">GROUP PRACTICE · PIN {room.code}</div>
          <div className="vp-cc-line">{stationType.icon} {st.title || st.cc}</div>
          <div className="vp-assess-meta">
            <span className="vp-mode-badge vp-mode-badge-t">{ROLE_META[myRole].icon} You're the {ROLE_META[myRole].label}</span>
            <span className={`vp-save-indicator ${connected ? "show" : ""}`}>{connected ? "● live" : "reconnecting…"}</span>
          </div>
        </div>
        <button className="vp-back-btn" onClick={leaveRoom}>← Leave</button>
      </div>

      {error && <div className="vp-voice-err" style={{ margin: "10px 0" }}>⚠ {error}</div>}

      {room.phase === "lobby" && (
        <Lobby
          room={room}
          isHost={isHost}
          send={send}
          onPickStation={() => setPickerOpen(true)}
        />
      )}
      {room.phase === "station" && (
        <StationPhase
          room={room}
          myRole={myRole}
          msLeft={msLeft}
          send={send}
          aiConfig={aiConfig}
          isHost={isHost}
        />
      )}
      {room.phase === "debrief" && (
        <Debrief room={room} myRole={myRole} isHost={isHost} send={send} />
      )}

      {pickerOpen && (
        <StationPicker
          onPick={(st) => { send({ type: "set_station", station: st }); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
      {bellFlash && <div className="vp-og-bell">🔔</div>}
    </div>
    </div>
  );
}

/* ── Lobby: members, roles, station, timer ─────────────────────────────── */
function Lobby({ room, isHost, send, onPickStation }) {
  const st = room.station || {};
  const roles = ["candidate", "examiner", "patient"];

  function roleOf(userId) {
    return Object.entries(room.roles || {}).find(([, uid]) => uid === userId)?.[0] || "observer";
  }

  return (
    <div className="vp-og-grid">
      <div className="vp-glass vp-og-panel">
        <div className="vp-panel-title">Station</div>
        <div className="vp-og-stinfo">
          <div className="vp-og-st-title">{(STATION_TYPES[st.station_type || "history"] || {}).icon} {st.title || st.cc}</div>
          <div className="vp-og-st-meta">{st.bed} · {st.demo} · {st.specialty}</div>
          {st.candidate_instructions && <div className="vp-og-st-inst">📄 {st.candidate_instructions}</div>}
        </div>
        {isHost && (
          <>
            <button className="vp-back-btn2" onClick={onPickStation}>Change station</button>
            <div className="vp-panel-title" style={{ marginTop: 16 }}>Station timer</div>
            <div className="vp-og-timer-row">
              {[300, 480, 600].map((s) => (
                <button
                  key={s}
                  className={`vp-chip ${room.timerSec === s ? "active" : ""}`}
                  onClick={() => send({ type: "set_timer", timerSec: s })}
                >{s / 60} min</button>
              ))}
            </div>
          </>
        )}
        <div className="vp-panel-title" style={{ marginTop: 16 }}>Roles</div>
        <div className="vp-og-role-summary">
          <div className="vp-og-role-slot">{ROLE_META.candidate.icon} Candidate: <b>{nameFor(room, room.roles?.candidate) || "—"}</b></div>
          <div className="vp-og-role-slot">{ROLE_META.examiner.icon} Examiner: <b>{nameFor(room, room.roles?.examiner) || "—"}</b></div>
          <div className="vp-og-role-slot">{ROLE_META.patient.icon} Patient: <b>{room.roles?.patient === "ai" ? "🤖 AI patient" : nameFor(room, room.roles?.patient) || "—"}</b></div>
        </div>
        {isHost ? (
          <button
            className="vp-cta-start"
            style={{ marginTop: 16 }}
            disabled={!room.roles?.candidate}
            onClick={() => send({ type: "start_station" })}
          >{room.roles?.candidate ? "🔔 Start station" : "Assign a candidate to start"}</button>
        ) : (
          <div className="vp-og-waiting">Waiting for the host to start the station…</div>
        )}
      </div>

      <div className="vp-glass vp-og-panel">
        <div className="vp-panel-title">Room · PIN <b className="vp-og-pinshow">{room.code}</b></div>
        {room.participants.map((p) => (
          <div key={p.userId} className="vp-og-member">
            <span className="vp-og-mcolor" style={{ background: p.color }} />
            <span className="vp-og-mname">{p.username}{p.isHost ? " 👑" : ""}{!p.connected ? " (reconnecting)" : ""}</span>
            {isHost ? (
              <div className="vp-og-role-btns">
                {roles.map((r) => (
                  <button
                    key={r}
                    className={`vp-og-rolebtn ${roleOf(p.userId) === r ? "on" : ""}`}
                    onClick={() => send({ type: "set_role", userId: p.userId, role: r })}
                  >{ROLE_META[r].icon}</button>
                ))}
                {roleOf(p.userId) === "patient" && (
                  <button
                    className="vp-og-rolebtn"
                    title="Replace with AI patient"
                    onClick={() => send({ type: "set_role", userId: p.userId, role: "patient", value: "ai" })}
                  >🤖</button>
                )}
              </div>
            ) : (
              <span className="vp-og-mrole">{ROLE_META[roleOf(p.userId)].icon} {ROLE_META[roleOf(p.userId)].label}</span>
            )}
          </div>
        ))}
        {isHost && room.roles?.patient !== "ai" && !room.roles?.patient && (
          <button
            className="vp-back-btn2"
            style={{ marginTop: 10 }}
            onClick={() => send({ type: "set_role", role: "patient", value: "ai" })}
          >🤖 Use AI patient instead</button>
        )}
        <div className="vp-og-hint">
          Candidate consults · Examiner ticks the checklist live · Patient plays the script (or let the AI do it) · everyone else observes.
        </div>
      </div>
    </div>
  );
}

function nameFor(room, userId) {
  return room.participants.find((p) => p.userId === userId)?.username;
}

/* ── Station phase: per-role views ─────────────────────────────────────── */
function StationPhase({ room, myRole, msLeft, send, aiConfig, isHost }) {
  const transcript = room.transcript || [];
  const logRef = useRef(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [transcript.length]);

  return (
    <div className="vp-og-station">
      <div className="vp-glass vp-og-timerbar">
        <span className={`vp-og-clock ${msLeft < 60000 ? "warn" : ""}`}>⏱ {fmtClock(msLeft)}</span>
        <span className="vp-og-stname">{room.station?.title || room.station?.cc}</span>
        {(isHost || myRole === "examiner") && (
          <button className="vp-voice-ctl end" onClick={() => send({ type: "end_station" })}>🔔 End station</button>
        )}
      </div>

      <div className="vp-og-stage">
        <div className="vp-glass vp-og-transcript">
          <div className="vp-panel-title">Consult feed</div>
          <div className="vp-og-log" ref={logRef}>
            {transcript.length === 0 && <div className="vp-empty-hint">Station started — the candidate opens the consult.</div>}
            {transcript.map((l, i) => (
              <div key={i} className={`vp-bubble ${l.role === "doc" ? "doc" : "pt"} ${l.role === "sys" ? "sys" : ""}`}>
                <span className="vp-who">
                  {l.role === "doc" ? "CANDIDATE" : l.role === "pt" ? (room.aiPatient ? "PATIENT · AI" : "PATIENT") : l.role === "ex" ? "EXAMINER" : "STATION"}
                </span>
                {l.text}
              </div>
            ))}
          </div>
        </div>

        <div className="vp-glass vp-og-rolepane">
          {myRole === "candidate" && <CandidatePane room={room} send={send} aiConfig={aiConfig} />}
          {myRole === "patient" && <PatientPane room={room} send={send} />}
          {myRole === "examiner" && <ExaminerPane room={room} send={send} />}
          {myRole === "observer" && <ObserverPane room={room} />}
        </div>
      </div>
    </div>
  );
}

function CandidatePane({ room, send, aiConfig }) {
  const [text, setText] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const agendaRevealedRef = useRef(false);
  const st = room.station || {};
  const ai = room.aiPatient;
  const examKeys = (st.examKeys || []).filter((k) => EXAM_LABELS[k]);

  async function say() {
    const q = text.trim();
    if (!q || aiBusy) return;
    setText("");
    send({ type: "say", role: "doc", text: q });
    if (!ai) return;

    // AI patient — run the same persona prompt locally, relay the reply.
    const trigger = st.script?.hidden_agenda && !agendaRevealedRef.current && invitesHiddenAgenda(q);
    if (trigger) agendaRevealedRef.current = true;
    setAiBusy(true);
    try {
      const reply = await callAIChat({
        system: buildPatientPrompt({ c: st.script || st, agendaState: { trigger, revealed: agendaRevealedRef.current }, question: q }),
        messages: [{ role: "user", content: q }],
        provider: aiConfig?.provider,
        model: aiConfig?.model,
      });
      send({ type: "ai_reply", text: reply || "…" });
    } catch {
      send({ type: "ai_reply", text: "(the patient seems distracted — try asking again)" });
    }
    setAiBusy(false);
  }

  return (
    <div>
      <div className="vp-panel-title">🩺 You're the candidate</div>
      {st.candidate_instructions && (
        <div className="vp-og-inst">📄 {st.candidate_instructions}</div>
      )}
      <div className="vp-og-actions">
        {examKeys.map((k) => (
          <button key={k} className="vp-og-act" onClick={() => send({ type: "exam", key: k, label: EXAM_LABELS[k] })}>
            {EXAM_LABELS[k]}
          </button>
        ))}
        {INV_QUICK.slice(0, 6).map((n) => (
          <button key={n} className="vp-og-act inv" onClick={() => send({ type: "inv", key: n.toLowerCase(), label: n })}>
            🧪 {n}
          </button>
        ))}
      </div>
      <div className="vp-input-bar" style={{ marginTop: 12 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && say()}
          placeholder={ai ? "Speak to the AI patient…" : "Speak to the patient…"}
          disabled={aiBusy}
        />
        <button className="vp-send-round" onClick={say} disabled={aiBusy || !text.trim()}>
          {aiBusy ? "…" : "➤"}
        </button>
      </div>
      {ai && <div className="vp-og-mini">🤖 AI patient replies on your device — replies broadcast to the room.</div>}
    </div>
  );
}

function PatientPane({ room, send }) {
  const [text, setText] = useState("");
  const script = room.station?.script || {};
  const hist = Object.entries(script.history || {});
  return (
    <div>
      <div className="vp-panel-title">🎭 You're the patient</div>
      <div className="vp-og-script">
        {script.persona && <div className="vp-og-script-sec"><b>Persona</b>{script.persona}</div>}
        {hist.length > 0 && (
          <div className="vp-og-script-sec">
            <b>Your story (only share when asked)</b>
            {hist.map(([k, v]) => <div key={k} className="vp-og-script-line"><span>{k}</span>{v}</div>)}
          </div>
        )}
        {script.hidden_agenda?.reveal && (
          <div className="vp-og-script-sec agenda">
            <b>🤫 Hold back unless they genuinely ask about your worries</b>
            {script.hidden_agenda.reveal}
          </div>
        )}
      </div>
      <div className="vp-input-bar" style={{ marginTop: 12 }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { send({ type: "say", role: "pt", text: text.trim() }); setText(""); } }}
          placeholder="Reply as the patient…"
        />
        <button className="vp-send-round" onClick={() => { if (text.trim()) { send({ type: "say", role: "pt", text: text.trim() }); setText(""); } }}>➤</button>
      </div>
    </div>
  );
}

function ExaminerPane({ room, send }) {
  const st = room.station || {};
  const items = [...(st.essential_points || []), ...(st.closing_points || [])];
  const critical = new Set(st.critical || []);
  const ticks = new Set(room.ticks || []);
  const [note, setNote] = useState(room.examinerNote || "");
  const noteTimer = useRef(null);

  function setTick(i, on) { send({ type: "tick", idx: i, on }); }
  function pushNote(v) {
    setNote(v);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => send({ type: "examiner_note", text: v }), 500);
  }

  return (
    <div className="vp-og-examiner">
      <div className="vp-panel-title">📋 Examiner checklist <span className="vp-og-tickcount">{ticks.size}/{items.length}</span></div>
      <div className="vp-og-checklist">
        {items.map((it, i) => (
          <button key={i} className={`vp-og-check ${ticks.has(i) ? "on" : ""}`} onClick={() => setTick(i, !ticks.has(i))}>
            <span className="vp-og-box">{ticks.has(i) ? "✓" : ""}</span>
            <span className="vp-og-check-text">
              {critical.has(i) && <span className="vp-crit-flag">🚩</span>}{it}
            </span>
          </button>
        ))}
      </div>
      <div className="vp-panel-title" style={{ marginTop: 14 }}>Global rating</div>
      <div className="vp-og-rating-row">
        {[["clear_pass", "🏆 Clear pass"], ["borderline", "⚖️ Borderline"], ["fail", "⚠️ Fail"]].map(([r, lbl]) => (
          <button key={r} className={`vp-og-rate ${room.globalRating === r ? "on-" + r : ""}`} onClick={() => send({ type: "global_rating", rating: r })}>{lbl}</button>
        ))}
      </div>
      <textarea
        className="vp-og-note"
        placeholder="Examiner note — verbal feedback for the debrief…"
        value={note}
        onChange={(e) => pushNote(e.target.value)}
      />
      <ExaminerSay send={send} />
    </div>
  );
}

function ExaminerSay({ send }) {
  const [t, setT] = useState("");
  const fire = () => { const v = t.trim(); if (!v) return; send({ type: "say", role: "ex", text: v }); setT(""); };
  return (
    <div className="vp-input-bar" style={{ marginTop: 10 }}>
      <input
        value={t}
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && fire()}
        placeholder="Interject as the examiner — viva probe, time check…"
      />
      <button className="vp-send-round" onClick={fire} disabled={!t.trim()}>➤</button>
    </div>
  );
}

function ObserverPane({ room }) {
  const st = room.station || {};
  const items = [...(st.essential_points || []), ...(st.closing_points || [])];
  const critical = new Set(st.critical || []);
  const ticks = new Set(room.ticks || []);
  return (
    <div>
      <div className="vp-panel-title">👀 Observing · mark scheme {ticks.size}/{items.length}</div>
      {room.globalRating && <div className="vp-og-obs-rating">Examiner rating: <b>{room.globalRating.replace("_", " ").toUpperCase()}</b></div>}
      <div className="vp-og-checklist">
        {items.map((it, i) => (
          <div key={i} className={`vp-og-check ro ${ticks.has(i) ? "on" : ""}`}>
            <span className="vp-og-box">{ticks.has(i) ? "✓" : ""}</span>
            <span className="vp-og-check-text">{critical.has(i) && <span className="vp-crit-flag">🚩</span>}{it}</span>
          </div>
        ))}
      </div>
      <div className="vp-og-hint" style={{ marginTop: 10 }}>You see the live consult and the examiner's ticks as they happen.</div>
    </div>
  );
}

/* ── Debrief ───────────────────────────────────────────────────────────── */
function Debrief({ room, myRole, isHost, send }) {
  const st = room.station || {};
  const items = [...(st.essential_points || []), ...(st.closing_points || [])];
  const critical = new Set(st.critical || []);
  const ticks = new Set(room.ticks || []);
  const critMissed = items.filter((_, i) => critical.has(i) && !ticks.has(i));
  const pct = items.length ? Math.round((ticks.size / items.length) * 100) : 0;

  return (
    <div className="vp-glass vp-og-debrief">
      <div className="vp-ob-title" style={{ textAlign: "center" }}>🔔 Station ended</div>
      <div className="vp-og-score-row">
        <div className="vp-og-score">{pct}<small>%</small></div>
        <div className="vp-og-score-lbl">checklist covered<br />{ticks.size}/{items.length} items</div>
      </div>
      {room.globalRating && (
        <div className={`vp-rating-banner ${room.globalRating}`} style={{ margin: "0 auto 14px" }}>
          <span className="vp-rating-icon">{room.globalRating === "clear_pass" ? "🏆" : room.globalRating === "borderline" ? "⚖️" : "⚠️"}</span>
          <div>
            <div className="vp-rating-label">EXAMINER: {room.globalRating.replace("_", " ").toUpperCase()}</div>
          </div>
        </div>
      )}
      {critMissed.length > 0 && (
        <div className="vp-og-critmiss">
          🚩 Critical items missed: {critMissed.map((c, i) => <div key={i}>• {c}</div>)}
        </div>
      )}
      {room.examinerNote && (
        <div className="vp-og-noteview"><b>Examiner note</b>{room.examinerNote}</div>
      )}
      <div className="vp-og-debrief-roles">
        {myRole === "candidate" && "Swap roles and run the next station — everyone should get a turn as candidate."}
        {myRole === "examiner" && "Talk through what you ticked and what you missed — that's the learning."}
        {myRole === "observer" && "What would you have done differently? Say it out loud to the group."}
        {myRole === "patient" && "How did it feel? Real patient perspective is the best feedback there is."}
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 16 }}>
        {isHost ? (
          <button className="vp-cta-start" onClick={() => send({ type: "back_to_lobby" })}>Back to lobby — rotate roles</button>
        ) : (
          <div className="vp-og-waiting">Waiting for the host to return to the lobby…</div>
        )}
      </div>
    </div>
  );
}

/* ── Station picker: built-in + custom stations ────────────────────────── */
function StationPicker({ onPick, onClose }) {
  const [tab, setTab] = useState("builtin");
  const [custom] = useState(() => getCustomStations());
  const list = tab === "builtin" ? CASES : custom;

  return createPortal(
    <>
      <div className="vp-drawer-backdrop show" onClick={onClose} />
      <div className="vp-tools-drawer open" style={{ maxHeight: "78vh" }}>
        <div className="vp-drawer-handle" />
        <div className="vp-drawer-header">
          <div className="vp-dh-icon">🗂</div>
          <div className="vp-dh-titles">
            <div className="vp-dh-title">Pick a station</div>
            <div className="vp-dh-sub">Everyone in the room sees this station</div>
          </div>
          <button className="vp-drawer-close" onClick={onClose}>✕</button>
        </div>
        <div className="vp-chip-row" style={{ padding: "0 16px" }}>
          <div className={`vp-chip ${tab === "builtin" ? "active" : ""}`} onClick={() => setTab("builtin")}>Built-in ({CASES.length})</div>
          <div className={`vp-chip ${tab === "custom" ? "active" : ""}`} onClick={() => setTab("custom")}>✎ My stations ({custom.length})</div>
        </div>
        <div className="vp-drawer-scroll">
          {list.length === 0 && (
            <div className="vp-empty-hint">
              {tab === "custom" ? "No custom stations yet — create one from the case-select screen." : "No stations."}
            </div>
          )}
          {list.map((c, i) => {
            const t = STATION_TYPES[c.station_type || "history"] || STATION_TYPES.history;
            return (
              <div key={c.id || i} className="vp-task" onClick={() => onPick(c)}>
                <div className="vp-task-ic">{t.icon}</div>
                <div className="vp-task-main">
                  <div className="vp-task-t">{c.title || c.cc}</div>
                  <div className="vp-task-cat">{c.bed} · {c.demo} · {c.specialty} · {t.label}</div>
                </div>
                <button className="vp-task-go">Use</button>
              </div>
            );
          })}
        </div>
      </div>
    </>,
    document.body
  );
}
