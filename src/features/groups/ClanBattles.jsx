import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { groupsApi } from "./groupsApi";
import { FdSheet, Avatar } from "../feed/feedUi.jsx";
import { MaterialPicker } from "../feed/Composer.jsx";
import { mcqVariant, mcqQuestionCount } from "../live-quiz/liveQuizApi.js";
import { initials, groupGradient } from "./groupUi.js";
import { toast } from "../../components/Toast.jsx";

const POLL_MS = 15000;

function TeamAvatar({ name }) {
  return <span className="gv-avatar" style={{ background: groupGradient(name) }}>{initials(name)}</span>;
}

const STATUS_LABEL = {
  pending: "Challenge sent",
  active: "Live",
  completed: "Finished",
  declined: "Declined",
  cancelled: "Cancelled",
  expired: "Expired",
};

function scoreline(b) {
  return `${b.a.name} ${b.a.score} – ${b.b.score} ${b.b.name}`;
}

// One battle row — actions depend on status + whether I'm the challenged
// captain (needsLineup) or a lineup member with a live room (joinable).
function BattleRow({ b, onAccept, onDecline, onJoin, onRing, ringState, busy }) {
  const done = ["completed", "declined", "cancelled", "expired"].includes(b.status);
  const winner = b.status === "completed" ? b.winnerId : null;
  return (
    <div className={`gv-battle-row${b.status === "active" ? " live" : ""}${done ? " ended" : ""}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <TeamAvatar name={b.a.name} />
        <span style={{ fontSize: 11, fontWeight: 800, color: "var(--app-faint)" }}>vs</span>
        <TeamAvatar name={b.b.name} />
      </div>
      <div className="gv-battle-row-info">
        <div className="gv-battle-row-title">
          {b.a.name} vs {b.b.name}
          {b.mode === "ranked" && <span className="fd-mini-chip">ranked</span>}
          {b.myTeam && <span className="fd-mini-chip">you{": "}{b.myTeam === "a" ? "A" : "B"}</span>}
        </div>
        <div className="gv-battle-row-meta">
          {b.status === "completed"
            ? `${b.a.size}v${b.b.size} · ${scoreline(b)} avg${winner ? ` — ${winner === b.a.id ? b.a.name : b.b.name} wins` : " — draw"}`
            : b.status === "pending" && b.needsLineup
              ? `challenges your clan — they field ${b.a.size}, you pick your side · ${b.numQuestions} questions · ${b.timePerQuestion || 20}s each`
              : b.status === "pending"
                ? `waiting for ${b.b.name} to answer · your ${b.a.size} players`
                : b.status === "active"
                  ? `${b.title || "battle"} · ${b.players} in lobby`
                  : STATUS_LABEL[b.status] || b.status}
          {b.status === "completed" && b.mode === "ranked" && (b.myTeam ? (b.myTeam === "a" ? b.a.ratingDelta : b.b.ratingDelta) : null) != null && (
            <span> · {(b.myTeam === "a" ? b.a.ratingDelta : b.b.ratingDelta) > 0 ? "+" : ""}{b.myTeam === "a" ? b.a.ratingDelta : b.b.ratingDelta} rating</span>
          )}
        </div>
      </div>
      {b.status === "pending" && b.needsLineup && (
        <div style={{ display: "flex", gap: 6 }}>
          <button className="fd-join-btn" disabled={busy} onClick={() => onAccept(b)}>Accept</button>
          <button className="fd-follow-btn" disabled={busy} onClick={() => onDecline(b)}>✕</button>
        </div>
      )}
      {b.status === "active" && b.joinable && b.liveCode && (
        <div style={{ display: "flex", gap: 6 }}>
          {onRing && (
            <button className="fd-follow-btn" title="Ring your clan into this battle" onClick={() => onRing(b)}>
              {ringState === true ? "✓" : "🔔"}
            </button>
          )}
          <button className="fd-join-btn" onClick={() => onJoin(b.liveCode)}>
            {b.livePhase === "lobby" || !b.livePhase ? "Join" : "Watch"}
          </button>
        </div>
      )}
      {b.status === "completed" && (
        <button
          className="fd-follow-btn"
          title="Share result"
          onClick={() => {
            const text = `⚔️ ${b.a.size}v${b.b.size}: ${scoreline(b)} on Scholar's Circle${winner ? ` — ${winner === b.a.id ? b.a.name : b.b.name} takes it!` : " — draw!"}`;
            window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + window.location.origin)}`, "_blank");
          }}
        >⧉</button>
      )}
    </div>
  );
}

// Pick 1..max players from a member list. Lineups can be asymmetric — battles
// are scored on per-participant average, so headcount is not an advantage.
function LineupSheet({ title, hint, members, max = 15, busy, error, onConfirm, onClose }) {
  const [picked, setPicked] = useState([]);
  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < max ? [...p, id] : p));
  return (
    <FdSheet title={title} onClose={onClose}>
      <div className="fd-sheet-sub">{hint} — pick 1–{max} players ({picked.length}/{max})</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10, maxHeight: 300, overflowY: "auto" }}>
        {members.map((m) => {
          const on = picked.includes(m.user?.id);
          return (
            <button
              key={m.user?.id || m.id}
              className={`fd-group-card${on ? " on" : ""}`}
              style={on ? { borderColor: "#F5A623", background: "rgba(245,166,35,0.08)" } : undefined}
              onClick={() => toggle(m.user?.id)}
            >
              <Avatar user={m.user} size={34} />
              <span className="fd-group-info">
                <span className="fd-group-card-name">
                  {m.user?.name || "Scholar"}
                  {m.isCreator && <span className="fd-mini-chip">creator</span>}
                  {m.role === "captain" && !m.isCreator && <span className="fd-mini-chip">captain</span>}
                </span>
                <span className="fd-group-card-meta">{m.streak || 0}d streak · {(m.xp || 0).toLocaleString()} XP</span>
              </span>
              <span style={{ fontWeight: 800, color: on ? "#F5A623" : "var(--app-faint)" }}>{on ? "✓" : "○"}</span>
            </button>
          );
        })}
      </div>
      {error && <div className="fd-sheet-sub" style={{ color: "#FF5470", marginTop: 8 }}>{error}</div>}
      <button
        className="fd-go-btn"
        style={{ width: "100%", marginTop: 12 }}
        disabled={picked.length < 1 || busy}
        onClick={() => onConfirm(picked)}
      >
        {busy ? "Working…" : `Lock lineup (${picked.length}/${max})`}
      </button>
    </FdSheet>
  );
}

// Challenge setup: 2 steps — (1) opponent + mode + questions, (2) lineup + schedule.
const BATTLE_TIMES = [15, 20, 30, 45, 60];
const BATTLE_MAX_QUESTIONS = 25; // server clamps challenge counts to this

function ChallengeSheet({ token, fromGroup, members, me, onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [customise, setCustomise] = useState(false);
  const [q, setQ] = useState("");
  const [candidates, setCandidates] = useState([]);
  const [opponent, setOpponent] = useState(null);
  const [mode, setMode] = useState("friendly");
  const [lineup, setLineup] = useState([me?.id].filter(Boolean));
  const [material, setMaterial] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCache, setPickerCache] = useState(null);
  const [scheduledFor, setScheduledFor] = useState("");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timePerQuestion, setTimePerQuestion] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [searchError, setSearchError] = useState(null);

  useEffect(() => {
    let dead = false;
    groupsApi
      .searchOpponents({ token, q: q.trim() || undefined, from: fromGroup.id })
      .then((list) => { if (!dead) { setCandidates(list || []); setSearchError(null); } })
      .catch(() => { if (!dead) setSearchError("Couldn't load groups — check your connection"); });
    return () => { dead = true; };
  }, [token, q, fromGroup.id]);

  const dedupedMembers = [];
  const seen = new Set();
  for (const m of members) {
    const uid = m.user?.id;
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    dedupedMembers.push(m);
  }

  const toggleLineup = (id) =>
    setLineup((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length < 15 ? [...p, id] : p));

  const materialMax = material ? Math.min(BATTLE_MAX_QUESTIONS, mcqQuestionCount(material)) : BATTLE_MAX_QUESTIONS;
  const effCount = Math.min(numQuestions, materialMax);

  // Free question count — same −/+ stepper (with hold-to-repeat) as a normal
  // live lobby. Local form state only; the server clamps to the material's
  // size and the battle cap when the challenge is sent.
  const countHoldRef = useRef(null);
  const stepCount = (d) => setNumQuestions((cur) => Math.min(Math.max(cur + d, 1), materialMax));
  const startCountHold = (e, d) => {
    e.preventDefault();
    stepCount(d);
    countHoldRef.current = setTimeout(() => {
      countHoldRef.current = setInterval(() => stepCount(d), 90);
    }, 400);
  };
  const stopCountHold = () => {
    clearTimeout(countHoldRef.current);
    clearInterval(countHoldRef.current);
    countHoldRef.current = null;
  };
  useEffect(() => stopCountHold, []);

  const submit = async () => {
    if (!opponent || !material || lineup.length < 1 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const mcq = mcqVariant(material);
      const battle = await groupsApi.createBattle({
        token,
        fromId: fromGroup.id,
        toId: opponent.id,
        mcqResourceId: mcq.id,
        mode,
        lineupIds: lineup,
        numQuestions: effCount,
        timePerQuestion,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      });
      onCreated?.(battle);
      onClose();
    } catch (e) {
      setError(e.message || "Couldn't send the challenge");
      setBusy(false);
    }
  };

  return (
    <FdSheet title={`⚔️ Challenge — ${fromGroup.name}`} onClose={onClose}>
      {/* Step indicator */}
      <div className="gv-step-row">
        <span className={`gv-step ${step >= 1 ? "active" : ""}`}>1</span>
        <span className="gv-step-line" />
        <span className={`gv-step ${step >= 2 ? "active" : ""}`}>2</span>
        <span className="gv-step-line" />
        <span className={`gv-step ${step >= 3 ? "active" : ""}`}>3</span>
        <span className="gv-step-label">{step === 1 ? "Who to challenge" : step === 2 ? "What to play" : "Lineup & schedule"}</span>
      </div>

      {step === 1 && (
        <>
          <div style={{ marginTop: 12 }}>
            <input
              className="fd-sheet-search"
              placeholder="Search clans by name or invite code…"
              value={q}
              onChange={(e) => { setQ(e.target.value); setOpponent(null); }}
            />
            {!opponent && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8, maxHeight: 180, overflowY: "auto" }}>
                {candidates.slice(0, 8).map((g) => (
                  <button key={g.id} className="fd-group-card" onClick={() => setOpponent(g)}>
                    <TeamAvatar name={g.name} />
                    <span className="fd-group-info">
                      <span className="fd-group-card-name">{g.name}</span>
                      <span className="fd-group-card-meta">{[g.subject, `${g.memberCount} members`, g.record].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                ))}
                {searchError && <div className="fd-empty-sub" style={{ padding: 8 }}>{searchError}</div>}
                {!searchError && candidates.length === 0 && (
                  <div className="fd-empty-sub" style={{ padding: 8 }}>
                    {q.trim() ? "No clans match — try their invite code." : "No clans to challenge yet."}
                  </div>
                )}
              </div>
            )}
            {opponent && (
              <div className="fd-group-card" style={{ borderColor: "#F5A623", marginTop: 8 }}>
                <TeamAvatar name={opponent.name} />
                <span className="fd-group-info">
                  <span className="fd-group-card-name">{opponent.name}</span>
                  <span className="fd-group-card-meta">{opponent.memberCount} members</span>
                </span>
                <button className="fd-link" onClick={() => setOpponent(null)}>change</button>
              </div>
            )}
          </div>

          <div className="gv-sort-row" style={{ marginTop: 12 }}>
            {[["friendly", "Friendly"], ["ranked", "Ranked 🏅"]].map(([v, l]) => (
              <button key={v} className={`gv-sort ${mode === v ? "active" : ""}`} onClick={() => setMode(v)}>{l}</button>
            ))}
          </div>

          <button
            className="fd-go-btn"
            style={{ width: "100%", marginTop: 12 }}
            disabled={!opponent}
            onClick={() => setStep(2)}
          >
            Next: pick the questions →
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <button className="fd-link" style={{ marginBottom: 8 }} onClick={() => setStep(1)}>← Back</button>
          <button className="fd-pill" style={{ width: "100%", marginTop: 4 }} onClick={() => setPickerOpen(true)}>
            {material ? `⚡ ${mcqVariant(material)?.title || material.title} — ${mcqQuestionCount(material)} questions` : "Pick the question set"}
          </button>

          {/* Battle terms — agreed at challenge time, locked once sent */}
          <div className="fd-sheet-sub" style={{ marginTop: 10, marginBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{material ? `${effCount} questions · ${timePerQuestion}s each · of ${mcqQuestionCount(material)} available` : "Pick a question set first"}</span>
            {material && <button className="fd-link" onClick={() => setCustomise((v) => !v)}>{customise ? "Done" : "Customise"}</button>}
          </div>
          {customise && material && (<>
          <div className="gv-sort-row" style={{ marginTop: 12 }}>
            {BATTLE_TIMES.map((t) => (
              <button key={t} className={`gv-sort${timePerQuestion === t ? " active" : ""}`} onClick={() => setTimePerQuestion(t)}>{t}s</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <span className="gv-step-label" style={{ marginLeft: 0 }}>Questions</span>
            <span className="fd-sheet-sub" style={{ margin: 0 }}>1–{materialMax}</span>
          </div>
          <div className="gv-stepper" style={{ marginTop: 6 }}>
            <button
              className="gv-step-btn"
              disabled={effCount <= 1 || !material}
              onPointerDown={(e) => startCountHold(e, -1)}
              onPointerUp={stopCountHold}
              onPointerLeave={stopCountHold}
              onPointerCancel={stopCountHold}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="Fewer questions"
            >−</button>
            <span className="gv-step-value">{effCount}</span>
            <button
              className="gv-step-btn"
              disabled={effCount >= materialMax || !material}
              onPointerDown={(e) => startCountHold(e, 1)}
              onPointerUp={stopCountHold}
              onPointerLeave={stopCountHold}
              onPointerCancel={stopCountHold}
              onContextMenu={(e) => e.preventDefault()}
              aria-label="More questions"
            >+</button>
          </div>
          </>)}

          {error && <div className="fd-sheet-sub" style={{ color: "#FF5470", marginTop: 8 }}>{error}</div>}
          <button
            className="fd-go-btn"
            style={{ width: "100%", marginTop: 12 }}
            disabled={!material || busy}
            onClick={() => setStep(3)}
          >
            Next: pick your lineup →
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <button className="fd-link" style={{ marginBottom: 8 }} onClick={() => setStep(2)}>← Back</button>

          <div className="fd-sheet-sub">Your lineup ({lineup.length}/15)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6, maxHeight: 200, overflowY: "auto" }}>
            {dedupedMembers.map((m) => {
              const on = lineup.includes(m.user?.id);
              return (
                <button
                  key={m.user?.id || m.id}
                  className="fd-group-card"
                  style={on ? { borderColor: "#F5A623", background: "rgba(245,166,35,0.08)" } : undefined}
                  onClick={() => toggleLineup(m.user?.id)}
                >
                  <Avatar user={m.user} size={30} />
                  <span className="fd-group-info">
                    <span className="fd-group-card-name">{m.user?.name}{m.isCreator && <span className="fd-mini-chip">creator</span>}</span>
                  </span>
                  <span style={{ fontWeight: 800, color: on ? "#F5A623" : "var(--app-faint)" }}>{on ? "✓" : "○"}</span>
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="fd-sheet-sub">Schedule for later (optional)</div>
            <input
              type="datetime-local"
              className="fd-sheet-search"
              style={{ marginTop: 6 }}
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
            />
          </div>

          {error && <div className="fd-sheet-sub" style={{ color: "#FF5470", marginTop: 8 }}>{error}</div>}
          <button
            className="fd-go-btn"
            style={{ width: "100%", marginTop: 12 }}
            disabled={lineup.length < 1 || busy}
            onClick={submit}
          >
            {busy ? "Sending…" : `Send ${mode} challenge (${lineup.length} players · ${effCount}q · ${timePerQuestion}s)`}
          </button>
        </>
      )}

      {pickerOpen && (
        <MaterialPicker
          token={token}
          cache={pickerCache}
          setCache={setPickerCache}
          mcqOnly
          onPick={(m) => { setMaterial(m); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </FdSheet>
  );
}

// ── Shared list body ─────────────────────────────────────────────────────────
function useBattleLoader(loader, deps) {
  const [battles, setBattles] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try {
      setBattles(await loader());
      setError(null);
    } catch (e) {
      setError(e.message || "Couldn't load battles");
    }
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [load]);
  return { battles, error, reload: load };
}

// All battles across my groups — used on the Groups tab.
export function ClanBattles({ token, me, onJoinQuiz }) {
  const navigate = useNavigate();
  const { battles, error, reload } = useBattleLoader(() => groupsApi.battlesMine({ token }), [token]);
  const [accepting, setAccepting] = useState(null);   // battle being accepted
  const [acceptMembers, setAcceptMembers] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [rung, setRung] = useState({});

  const join = useCallback(
    (code) => (onJoinQuiz ? onJoinQuiz(code) : navigate(`/live/${code}`)),
    [onJoinQuiz, navigate]
  );

  // Ring my clan into a live battle — my side's group id comes from myTeam.
  const ring = useCallback(async (b) => {
    const groupId = b[b.myTeam === "b" ? "b" : "a"]?.id;
    if (!groupId || !b.liveCode) return;
    try {
      await groupsApi.ring({ token, id: groupId, code: b.liveCode });
      setRung((r) => ({ ...r, [b.id]: true }));
    } catch (e) {
      toast.error(e.message || "Couldn't ring the group");
    }
    setTimeout(() => setRung((r) => ({ ...r, [b.id]: null })), 4000);
  }, [token]);

  const startAccept = async (b) => {
    setBusy(true);
    setActionError(null);
    try {
      const members = await groupsApi.members({ token, id: b.b.id });
      // My side is team B (challenged). Creator row + member rows share users — dedupe.
      const seen = new Set();
      setAcceptMembers(members.filter((m) => (m.user?.id && !seen.has(m.user.id) && seen.add(m.user.id))));
      setAccepting(b);
    } catch (e) {
      setActionError(e.message || "Couldn't load your members");
    } finally {
      setBusy(false);
    }
  };

  const decline = async (b) => {
    if (busy) return;
    setBusy(true);
    try {
      await groupsApi.declineBattle({ token, id: b.id });
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmAccept = async (lineupIds) => {
    setBusy(true);
    try {
      const res = await groupsApi.acceptBattle({ token, id: accepting.id, lineupIds });
      setAccepting(null);
      reload();
      if (res.code) join(res.code);
    } catch (e) {
      setActionError(e.message || "Couldn't accept");
      setBusy(false);
    }
  };

  const incoming = (battles || []).filter((b) => b.status === "pending" && b.needsLineup);
  const active = (battles || []).filter((b) => b.status === "active");
  const outgoing = (battles || []).filter((b) => b.status === "pending" && !b.needsLineup);
  const history = (battles || []).filter((b) => ["completed", "declined", "cancelled", "expired"].includes(b.status));

  return (
    <div className="gv-battles">
      {incoming.length > 0 && (
        <div className="gv-battle-section">
          <div className="gv-battle-section-title">⚔️ Challenges for you</div>
          {incoming.map((b) => (
            <BattleRow key={b.id} b={b} busy={busy} onAccept={startAccept} onDecline={decline} onJoin={join} onRing={ring} ringState={rung[b.id]} />
          ))}
        </div>
      )}
      {active.length > 0 && (
        <div className="gv-battle-section">
          <div className="gv-battle-section-title">🔴 Live battles</div>
          {active.map((b) => (
            <BattleRow key={b.id} b={b} busy={busy} onAccept={startAccept} onDecline={decline} onJoin={join} onRing={ring} ringState={rung[b.id]} />
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <div className="gv-battle-section">
          <div className="gv-battle-section-title">Outgoing challenges</div>
          {outgoing.map((b) => (
            <BattleRow key={b.id} b={b} busy={busy} onAccept={startAccept} onDecline={decline} onJoin={join} onRing={ring} ringState={rung[b.id]} />
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div className="gv-battle-section">
          <div className="gv-battle-section-title">Recent results</div>
          {history.slice(0, 6).map((b) => (
            <BattleRow key={b.id} b={b} busy={busy} onAccept={startAccept} onDecline={decline} onJoin={join} onRing={ring} ringState={rung[b.id]} />
          ))}
        </div>
      )}
      {battles === null && !error && (
        <div className="fd-skeletons">{[0].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 64 }} />)}</div>
      )}
      {error && (
        <div className="fd-empty">
          <div className="fd-empty-title">Couldn't load battles</div>
          <div className="fd-empty-sub">{error}</div>
          <button className="fd-follow-btn" onClick={reload}>Retry</button>
        </div>
      )}
      {battles !== null && battles.length === 0 && !error && (
        <div className="gv-battles-empty">
          <span className="gv-battles-empty-text">No active battles — challenge a rival clan to start a war.</span>
        </div>
      )}
      {actionError && <div className="fd-empty-sub" style={{ color: "#FF5470" }}>{actionError}</div>}

      {accepting && acceptMembers && (
        <LineupSheet
          title={`Accept — ${accepting.a.name} vs ${accepting.b.name}`}
          hint={`They field ${accepting.a.size} — ${accepting.mode === "ranked" ? "ranked, lineup locked once it starts" : "pick who defends your clan"}`}
          members={acceptMembers}
          max={15}
          busy={busy}
          error={actionError}
          onConfirm={confirmAccept}
          onClose={() => { setAccepting(null); setActionError(null); }}
        />
      )}
    </div>
  );
}

// One group's battles + the "Challenge a group" entry point — the clan-war hub
// inside GroupView's Play tab.
export function GroupClanBattles({ token, group, me, members, isCaptain, onJoinQuiz, hideHero = false, challengeSignal = 0 }) {
  const navigate = useNavigate();
  const { battles, error, reload } = useBattleLoader(
    () => groupsApi.groupBattles({ token, id: group.id }),
    [token, group.id]
  );
  const [challengeOpen, setChallengeOpen] = useState(false);
  useEffect(() => { if (challengeSignal && isCaptain) setChallengeOpen(true); }, [challengeSignal, isCaptain]);
  const [accepting, setAccepting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [rung, setRung] = useState({});

  const join = useCallback(
    (code) => (onJoinQuiz ? onJoinQuiz(code) : navigate(`/live/${code}`)),
    [onJoinQuiz, navigate]
  );

  const ring = useCallback(async (b) => {
    if (!b.liveCode) return;
    try {
      await groupsApi.ring({ token, id: group.id, code: b.liveCode });
      setRung((r) => ({ ...r, [b.id]: true }));
    } catch (e) {
      toast.error(e.message || "Couldn't ring the group");
    }
    setTimeout(() => setRung((r) => ({ ...r, [b.id]: null })), 4000);
  }, [token, group.id]);

  const dedupedMembers = [];
  const seen = new Set();
  for (const m of members || []) {
    const uid = m.user?.id;
    if (!uid || seen.has(uid)) continue;
    seen.add(uid);
    dedupedMembers.push(m);
  }

  const decline = async (b) => {
    if (busy) return;
    setBusy(true);
    try {
      await groupsApi.declineBattle({ token, id: b.id });
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmAccept = async (lineupIds) => {
    setBusy(true);
    try {
      const res = await groupsApi.acceptBattle({ token, id: accepting.id, lineupIds });
      setAccepting(null);
      reload();
      if (res.code) join(res.code);
    } catch (e) {
      setActionError(e.message || "Couldn't accept");
      setBusy(false);
    }
  };

  const open = (battles || []).filter((b) => ["pending", "active"].includes(b.status));
  const history = (battles || []).filter((b) => !["pending", "active"].includes(b.status));

  return (
    <div className="gv-battles">
      {!hideHero && (
      <div className="gv-battles-hero">
        <div className="gv-battles-hero-text">
          <b>Clan battles</b>
          <span>Challenge another group — same questions, same clock; the higher per-player average wins, so any lineup size works{group.rating != null ? ` · 🏅 ${group.rating} rating` : ""}.</span>
        </div>
        {isCaptain && (
          <button className="fd-go-btn" onClick={() => setChallengeOpen(true)}>⚔️ Challenge</button>
        )}
      </div>
      )}

      {open.length > 0 && (
        <div className="gv-battle-section">
          <div className="gv-battle-section-title">Open</div>
          {open.map((b) => (
            <BattleRow
              key={b.id}
              b={b}
              busy={busy}
              onAccept={(bb) => setAccepting(bb)}
              onDecline={decline}
              onJoin={join}
              onRing={ring}
              ringState={rung[b.id]}
            />
          ))}
        </div>
      )}
      {history.length > 0 && (
        <div className="gv-battle-section">
          <div className="gv-battle-section-title">History</div>
          {history.slice(0, 8).map((b) => (
            <BattleRow key={b.id} b={b} busy={busy} onAccept={(bb) => setAccepting(bb)} onDecline={decline} onJoin={join} onRing={ring} ringState={rung[b.id]} />
          ))}
        </div>
      )}
      {battles === null && !error && (
        <div className="fd-skeletons">{[0].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 64 }} />)}</div>
      )}
      {error && (
        <div className="fd-empty">
          <div className="fd-empty-title">Couldn't load battles</div>
          <div className="fd-empty-sub">{error}</div>
          <button className="fd-follow-btn" onClick={reload}>Retry</button>
        </div>
      )}
      {battles && battles.length === 0 && !isCaptain && (
        <div className="fd-empty-sub">No clan battles yet — a captain can send the first challenge.</div>
      )}
      {actionError && <div className="fd-empty-sub" style={{ color: "#FF5470" }}>{actionError}</div>}

      {challengeOpen && (
        <ChallengeSheet
          token={token}
          fromGroup={group}
          members={dedupedMembers}
          me={me}
          onClose={() => setChallengeOpen(false)}
          onCreated={() => reload()}
        />
      )}
      {accepting && (
        <LineupSheet
          title={`Accept — ${accepting.a.name} vs ${accepting.b.name}`}
          hint={`They field ${accepting.a.size} — pick who defends your clan`}
          members={dedupedMembers}
          max={15}
          busy={busy}
          error={actionError}
          onConfirm={confirmAccept}
          onClose={() => { setAccepting(null); setActionError(null); }}
        />
      )}
    </div>
  );
}
