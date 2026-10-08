import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getLiveRoom, joinLiveRoom } from "./liveQuizApi.js";
import LiveQuizRoom from "./LiveQuizRoom.jsx";
import { IconSpinner, IconUsers, IconZap } from "./icons.jsx";
import "./live-quiz.css";

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
  } catch {
    return {};
  }
}

export default function LiveQuizPage() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const myId = getAuth().authUser?.id || null;
  const isAuthed = !!getAuth().authToken;
  const wantJoin = new URLSearchParams(location.search).get("join") === "1";

  // Host arrives here right after create — ticket passed via router state
  const [joined, setJoined] = useState(location.state?.ticket ? { ticket: location.state.ticket, roomId: location.state.roomId } : null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const [joining, setJoining] = useState(false);
  const autoJoinRef = useRef(false);

  useEffect(() => {
    if (joined) return;
    let cancelled = false;
    getLiveRoom(code)
      .then((data) => { if (!cancelled) setPreview(data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [code, joined]);

  const join = async () => {
    setJoining(true);
    setError(null);
    try {
      const res = await joinLiveRoom(code);
      setJoined({ ticket: res.ticket, roomId: res.roomId });
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  };

  // ?join=1 is set by the invite flow — after signup/login the user returns
  // here and drops straight into the lobby without a second tap.
  useEffect(() => {
    if (!wantJoin || autoJoinRef.current || !isAuthed || !preview || joined || joining) return;
    if (!preview.joinable && !preview.isMember) return;
    autoJoinRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    join();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantJoin, isAuthed, preview, joined, joining]);

  // Return to wherever the session was launched (shared landing, /app tab…),
  // never the bare /resources route that strands users outside the app shell.
  const exit = () => navigate(location.state?.returnTo || "/app", { replace: true });

  if (joined) {
    return (
      <div className="dark" style={{ height: "100dvh", background: "#05070a" }}>
        <LiveQuizRoom roomId={joined.roomId} ticket={joined.ticket} myId={myId} onExit={exit} />
      </div>
    );
  }

  const signupRedirect = `/signup?redirect=${encodeURIComponent(`/live/${code}?join=1`)}`;
  const loginRedirect = `/login?redirect=${encodeURIComponent(`/live/${code}?join=1`)}`;

  return (
    <div className="dark" style={{ minHeight: "100dvh", background: "#05070a", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div className="lq-app" style={{ height: "auto", minHeight: 0, maxWidth: 420, borderRadius: 24, padding: 28 }}>
        {error && !preview ? (
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 40, margin: "0 0 12px" }}>🔴</p>
            <p className="lq-title" style={{ fontSize: 20 }}>Can't join this session</p>
            <p className="lq-subtitle">{error}</p>
            <button className="lq-btn-primary" onClick={exit}>Back to My Space</button>
          </div>
        ) : !preview ? (
          <div style={{ textAlign: "center", padding: 30 }}>
            <IconSpinner size={28} style={{ color: "#F5C542" }} />
            <p style={{ color: "#9CA3AF", fontSize: 14, marginTop: 12 }}>Loading session…</p>
          </div>
        ) : (
          <div>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <span className="lq-live-badge" style={{ display: "inline-flex" }}>
                <span className="lq-live-dot" />LIVE SESSION
              </span>
              <h2 className="lq-title" style={{ marginTop: 12 }}>{preview.title}</h2>
              <p className="lq-subtitle" style={{ marginBottom: 0 }}>
                Hosted by {preview.host}
              </p>
            </div>

            <div className="lq-settings-summary" style={{ marginBottom: 20 }}>
              <div className="lq-summary-item"><IconUsers size={16} /> {preview.participantCount}/{preview.maxParticipants} in the lobby</div>
              <div className="lq-summary-item"><IconZap size={16} /> {preview.settings?.numQuestions || "—"} questions · {preview.settings?.timePerQuestion || 30}s each</div>
            </div>

            {error && <p style={{ fontSize: 13, color: "#FF6B5E", marginBottom: 12, textAlign: "center" }}>{error}</p>}

            {!isAuthed ? (
              <>
                <button className="lq-btn-primary" onClick={() => navigate(signupRedirect)}>
                  Sign up free to join
                </button>
                <button className="lq-btn-secondary" onClick={() => navigate(loginRedirect)}>
                  I have an account — log in
                </button>
                <p style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 10, marginBottom: 0 }}>
                  You'll land right back in this lobby after signing up.
                </p>
              </>
            ) : preview.joinable || preview.isMember ? (
              <button className="lq-btn-primary" onClick={join} disabled={joining}>
                {joining ? "Joining…" : preview.isMember ? "Rejoin Session" : "Join Session"}
              </button>
            ) : (
              <>
                <button className="lq-btn-primary" disabled>
                  {preview.phase === "complete" ? "Session has finished" : "Session already in progress"}
                </button>
                <p style={{ fontSize: 11, color: "#6B7280", textAlign: "center", marginTop: 8 }}>
                  {preview.phase === "complete"
                    ? "This live quiz wrapped up — ask the host for a rematch."
                    : "This live quiz already started — ask the host to start a new one."}
                </p>
              </>
            )}
            {isAuthed && <button className="lq-btn-secondary" onClick={exit}>Back</button>}
          </div>
        )}
      </div>
    </div>
  );
}
