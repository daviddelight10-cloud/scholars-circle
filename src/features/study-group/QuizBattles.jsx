import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../lib/constants";
import { Avatar } from "../feed/feedUi";
import { MaterialPicker } from "../feed/Composer.jsx";
import { createLiveRoom, mcqVariant, mcqQuestionCount } from "../live-quiz/liveQuizApi.js";

const POLL_MS = 10000;

// Real quiz battles: host picks an MCQ material → a live-quiz room opens and
// an invite card lands in the group chat. Members join from here or the card.
export default function QuizBattles({ classroomId, token, currentUser, onJoinQuiz }) {
  const navigate = useNavigate();
  const [battles, setBattles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCache, setPickerCache] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const authHeaders = { Authorization: `Bearer ${token}` };
  const myName = currentUser?.fullName || currentUser?.username || "Someone";

  const openBattle = useCallback((code) => {
    if (onJoinQuiz) return onJoinQuiz(code);
    navigate(`/live/${code}`);
  }, [onJoinQuiz, navigate]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/study-group/${classroomId}/battles`, { headers: authHeaders });
      if (!res.ok) throw new Error("Failed to load");
      setBattles(await res.json());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [classroomId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
    const iv = setInterval(load, POLL_MS);
    return () => clearInterval(iv);
  }, [load]);

  const startBattle = async (material) => {
    const mcq = mcqVariant(material);
    if (!mcq || busy) return;
    setBusy(true);
    setPickerOpen(false);
    try {
      const room = await createLiveRoom(mcq.id);
      // Drop the invite card into group chat
      await fetch(`${API_BASE}/study-group/${classroomId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          text: `${myName} started a quiz battle — ${mcqQuestionCount(material)} questions`,
          resourceId: material.id,
          liveCode: room.code,
        }),
      });
      openBattle(room.code);
    } catch (e) {
      alert(e.message || "Couldn't start the battle");
      setBusy(false);
    }
  };

  const live = battles.filter((b) => b.live);
  const past = battles.filter((b) => !b.live);

  return (
    <div className="gv-battles">
      <div className="gv-battles-hero">
        <div className="gv-battles-hero-text">
          <b>Quiz battles</b>
          <span>Same questions, same clock — highest score wins. Everyone in the group can join from the chat card.</span>
        </div>
        <button className="fd-go-btn" onClick={() => setPickerOpen(true)} disabled={busy}>
          {busy ? "Creating…" : "⚔️ Start a battle"}
        </button>
      </div>

      {loading && (
        <div className="fd-skeletons">
          {[0, 1].map((i) => <div key={i} className="fd-card fd-skeleton" style={{ height: 72 }} />)}
        </div>
      )}
      {error && !loading && battles.length === 0 && (
        <div className="fd-empty"><div className="fd-empty-title">Couldn't load battles</div><div className="fd-empty-sub">{error}</div></div>
      )}

      {live.length > 0 && (
        <div className="gv-battle-section">
          <div className="gv-battle-section-title">🔴 Live now</div>
          {live.map((b) => (
            <div key={b.id} className="gv-battle-row live">
              <Avatar user={b.host} size={38} />
              <div className="gv-battle-row-info">
                <div className="gv-battle-row-title">{b.title}</div>
                <div className="gv-battle-row-meta">
                  hosted by {b.host?.name || "member"} · {b.players} in lobby
                </div>
              </div>
              <button className="fd-join-btn" onClick={() => openBattle(b.code)} disabled={!b.joinable}>
                {b.joinable ? "Join" : "Live"}
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && battles.length === 0 && (
        <div className="fd-empty">
          <div className="fd-empty-icon">⚔️</div>
          <div className="fd-empty-title">No battles yet</div>
          <div className="fd-empty-sub">
            Start a battle from any Rapid Recall set — an invite card lands in the chat for everyone to join.
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div className="gv-battle-section">
          <div className="gv-battle-section-title">Recent battles</div>
          {past.map((b) => (
            <div key={b.id} className="gv-battle-row ended">
              <Avatar user={b.host} size={38} />
              <div className="gv-battle-row-info">
                <div className="gv-battle-row-title">{b.title}</div>
                <div className="gv-battle-row-meta">
                  hosted by {b.host?.name || "member"} · {new Date(b.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
              </div>
              <span className="gv-battle-ended-chip">Ended</span>
            </div>
          ))}
        </div>
      )}

      {pickerOpen && (
        <MaterialPicker
          token={token}
          cache={pickerCache}
          setCache={setPickerCache}
          mcqOnly
          onPick={startBattle}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
