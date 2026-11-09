import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getLiveRoom, joinLiveRoom } from "./liveQuizApi.js";
import { ensureAppSession } from "../../lib/authToken.js";
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
  const [auth, setAuth] = useState(getAuth);
  const myId = auth.authUser?.id || null;
  const isAuthed = !!auth.authToken;
  // Guests land here with no session; a post-signup return (email-confirm or
  // OAuth) arrives with a live Supabase session but no scholars-circle-auth.
  // Recover it before showing the signup CTA — otherwise a brand-new user
  // loops right back to the signup page they just finished.
  const [sessionChecked, setSessionChecked] = useState(() => !!auth.authUser);
  const wantJoin = new URLSearchParams(location.search).get("join") === "1";

  useEffect(() => {
    if (auth.authUser) return;
    let live = true;
    ensureAppSession().then((u) => {
      if (!live) return;
      if (u) setAuth(getAuth());
      setSessionChecked(true);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    if (!preview.joinable && !preview.spectatable && !preview.isMember) return;
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
      <div style={{ height: "100dvh", background: "var(--c-0a0c10)" }}>
        <LiveQuizRoom roomId={joined.roomId} ticket={joined.ticket} myId={myId} onExit={exit} />
      </div>
    );
  }

  const signupRedirect = `/signup?redirect=${encodeURIComponent(`/live/${code}?join=1`)}`;
  const loginRedirect = `/login?redirect=${encodeURIComponent(`/live/${code}?join=1`)}`;

  return (
    <div style={{ minHeight: "100dvh", background: "var(--c-0a0c10)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
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
            <p style={{ color: "var(--app-dim)", fontSize: 14, marginTop: 12 }}>Loading session…</p>
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
              !sessionChecked ? (
                <p style={{ color: "var(--app-dim)", fontSize: 14, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <IconSpinner size={16} style={{ color: "#F5C542" }} /> Checking your session…
                </p>
              ) : (
              <>
                <button className="lq-btn-primary" onClick={() => navigate(signupRedirect)}>
                  Sign up free to join
                </button>
                <button className="lq-btn-secondary" onClick={() => navigate(loginRedirect)}>
                  I have an account — log in
                </button>
                <p style={{ fontSize: 11, color: "var(--app-dim)", textAlign: "center", marginTop: 10, marginBottom: 0 }}>
                  You'll land right back in this lobby after signing up.
                </p>
              </>
              )
            ) : preview.joinable || preview.isMember || preview.spectatable ? (
              <>
                <button className="lq-btn-primary" onClick={join} disabled={joining}>
                  {joining ? "Joining…" : preview.isMember ? "Rejoin Session" : preview.joinable ? "Join Session" : "Watch live"}
                </button>
                {!preview.joinable && !preview.isMember && (
                  <p style={{ fontSize: 11, color: "var(--app-dim)", textAlign: "center", marginTop: 8 }}>
                    This quiz already started — you can watch now and play from a later question.
                  </p>
                )}
              </>
            ) : (
              <>
                <button className="lq-btn-primary" disabled>Session has finished</button>
                <p style={{ fontSize: 11, color: "var(--app-dim)", textAlign: "center", marginTop: 8 }}>
                  This live quiz wrapped up — ask the host for a rematch.
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
