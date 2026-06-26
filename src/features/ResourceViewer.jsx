import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, copyShareToken } from "../lib/researchUtils";
import PdfReader from "./PdfReader.jsx";
import McqQuizRunner from "./McqQuizRunner.jsx";

import { API_BASE } from "../lib/constants";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ============ RATINGS & COMMENTS COMPONENT ============
function RatingsAndComments({ resourceId }) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [avgRating, setAvgRating] = useState(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [showFlagBox, setShowFlagBox] = useState(false);
  const [flagText, setFlagText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}`, "Content-Type": "application/json" };
  };

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resourceId}/comments`);
      if (res.ok) setComments(await res.json());
    } catch {}
    setLoading(false);
  }, [resourceId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const submitRating = async (stars) => {
    setRating(stars);
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resourceId}/rate`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ stars }),
      });
      if (res.ok) {
        const data = await res.json();
        setAvgRating(data.avgRating);
        setRatingCount(data.ratingCount);
      }
    } catch {}
  };

  const submitComment = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resourceId}/comments`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: commentText.trim() }),
      });
      if (res.ok) {
        const newComment = await res.json();
        setComments((prev) => [newComment, ...prev]);
        setCommentText("");
      }
    } catch {}
    setSubmitting(false);
  };

  const submitFlag = async () => {
    if (!flagText.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resourceId}/flag`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ text: flagText.trim() }),
      });
      if (res.ok) {
        setShowFlagBox(false);
        setFlagText("");
        fetchComments();
      }
    } catch {}
    setSubmitting(false);
  };

  return (
    <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "18px", marginTop: "16px" }}>
      <div style={{ fontSize: "14px", fontWeight: 700, color: "#c5c9e8", marginBottom: "14px" }}>Ratings & Comments</div>

      {/* Star Rating */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
        <div style={{ display: "flex", gap: "4px" }}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              onClick={() => submitRating(s)}
              onMouseEnter={() => setHoverRating(s)}
              onMouseLeave={() => setHoverRating(0)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "20px", color: (hoverRating || rating) >= s ? "#f5a623" : "#2a2d4a", padding: "2px" }}
            >
              ★
            </button>
          ))}
        </div>
        {avgRating !== null && (
          <span style={{ fontSize: "12px", color: "#7b82b8" }}>{avgRating.toFixed(1)} ({ratingCount} rating{ratingCount !== 1 ? "s" : ""})</span>
        )}
      </div>

      {/* Comment Input */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
        <input
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Write a comment..."
          style={{ flex: 1, background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#9fa8da", outline: "none" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !submitting) submitComment(); }}
        />
        <button
          onClick={submitComment}
          disabled={submitting || !commentText.trim()}
          style={{ padding: "10px 16px", background: "#1a237e", border: "0.5px solid #3949ab", borderRadius: "8px", fontSize: "13px", fontWeight: 600, color: "#c5cae9", cursor: "pointer", opacity: submitting || !commentText.trim() ? 0.5 : 1 }}
        >Post</button>
      </div>

      {/* Flag as outdated/wrong */}
      {!showFlagBox ? (
        <button
          onClick={() => setShowFlagBox(true)}
          style={{ background: "none", border: "none", color: "#ff5470", fontSize: "11px", cursor: "pointer", marginBottom: "14px", padding: 0 }}
        >
          ⚑ Flag as outdated or wrong
        </button>
      ) : (
        <div style={{ marginBottom: "14px", padding: "12px", background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "8px" }}>
          <textarea
            value={flagText}
            onChange={(e) => setFlagText(e.target.value)}
            placeholder="What's wrong with this resource?"
            style={{ width: "100%", background: "#0d0f20", border: "0.5px solid #2a2d4a", borderRadius: "6px", padding: "8px", fontSize: "12px", color: "#9fa8da", outline: "none", resize: "vertical", minHeight: "50px", marginBottom: "8px" }}
          />
          <div style={{ display: "flex", gap: "8px" }}>
            <button onClick={() => { setShowFlagBox(false); setFlagText(""); }} style={{ flex: 1, padding: "8px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "6px", fontSize: "12px", color: "#7986cb", cursor: "pointer" }}>Cancel</button>
            <button onClick={submitFlag} disabled={submitting || !flagText.trim()} style={{ flex: 1, padding: "8px", background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "6px", fontSize: "12px", color: "#ef9a9a", cursor: "pointer", opacity: submitting || !flagText.trim() ? 0.5 : 1 }}>Submit Flag</button>
          </div>
        </div>
      )}

      {/* Comments List */}
      {loading ? (
        <div style={{ fontSize: "12px", color: "#4a5080" }}>Loading comments...</div>
      ) : comments.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#4a5080" }}>No comments yet — be the first to share feedback.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {comments.map((c) => (
            <div key={c.id} style={{ padding: "10px 12px", background: "#0a0c1e", border: c.flagged ? "0.5px solid #4a1010" : "0.5px solid #1e2245", borderRadius: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#7986cb" }}>{c.user?.fullName || c.user?.username || "Anonymous"}</span>
                {c.flagged && <span style={{ fontSize: "10px", color: "#ff5470" }}>⚑ Flagged</span>}
              </div>
              <div style={{ fontSize: "13px", color: "#c5c9e8", lineHeight: 1.4 }}>{c.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// token prop: used when rendered in-app (overrides useParams)
// onBack prop: called by Back button (overrides navigate) — used for in-app rendering
export default function ResourceViewer({ token: tokenProp, onBack, onQuizComplete, initialPage } = {}) {
  const params = useParams();
  const navigate = useNavigate();
  const token = tokenProp || params.token;

  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authCase, setAuthCase] = useState("loggedin"); // loggedin | guest | new
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);
  const [trialInfo, setTrialInfo] = useState(null); // { allowed, freeTrialViews, freeTrialLimit }

  // Auth form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // MCQ state
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (token) fetchResource();
  }, [token]);

  const checkAuth = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      if (parsed.authUser) {
        setUser(parsed.authUser);
        setAuthCase("loggedin");
        return;
      }
    } catch (e) {}
    setAuthCase("guest");
  };

  const getCached = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(key); return null; }
      return data;
    } catch { return null; }
  };

  const setCache = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
  };

  const fetchResource = async () => {
    setLoading(true);
    const cacheKey = `sc_resource_${token}`;
    const cached = getCached(cacheKey);
    if (cached) { setResource(cached); setLoading(false); triggerLogView(cached); return; }
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const res = await fetch(`${API_BASE}/api/resources/${token}`, {
        headers: authData.authToken ? { Authorization: `Bearer ${authData.authToken}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setCache(cacheKey, data);
        setResource(data);
        triggerLogView(data);
      } else if (res.status === 404) {
        setError("Resource not found");
      } else {
        setError("Failed to load resource");
      }
    } catch {
      setError("Failed to load resource. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const triggerLogView = async (res) => {
    try {
      const parsed = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      const jwtToken = parsed.authToken || null;
      if (!jwtToken) return; // guests handled via auth overlay
      const r = await fetch(`${API_BASE}/api/resources/${res.shareToken || token}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwtToken}` },
      });
      const info = await r.json();
      setTrialInfo(info);
    } catch {}
  };

  const handleBack = () => {
    if (onBack) { onBack(); return; }
    window.dispatchEvent(new CustomEvent("sc-open-research-hub"));
    navigate("/app");
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        const authPayload = { authUser: data.user, authToken: data.token };
        localStorage.setItem("scholars-circle-auth", JSON.stringify(authPayload));
        setUser(data.user);
        setAuthCase("loggedin");
        triggerLogView(resource || { shareToken: token });
      } else {
        setAuthError(data.error || "Login failed");
      }
    } catch {
      setAuthError("Login failed. Please check your connection.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickSignup = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    // Sanitize username: strip spaces, use underscore, lowercase
    const username = signupName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (username.length < 3) { setAuthError("Name must be at least 3 characters (letters/numbers)"); setAuthLoading(false); return; }
    if (signupPassword.length < 8) { setAuthError("Password must be at least 8 characters"); setAuthLoading(false); return; }
    const email = signupEmail.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAuthError("Please enter a valid email address"); setAuthLoading(false); return; }
    try {
      // Step 1: Register
      const regRes = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password: signupPassword }),
      });
      const regData = await regRes.json();
      if (!regRes.ok) { setAuthError(regData.error || "Sign up failed"); setAuthLoading(false); return; }
      // Step 2: Auto-login to get token
      const loginRes = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: username, password: signupPassword }),
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) { setAuthError("Account created! Please log in."); setAuthCase("guest"); setAuthLoading(false); return; }
      const authPayload = { authUser: loginData.user, authToken: loginData.token };
      localStorage.setItem("scholars-circle-auth", JSON.stringify(authPayload));
      setUser(loginData.user);
      setAuthCase("loggedin");
      triggerLogView(resource || { shareToken: token });
    } catch {
      setAuthError("Sign up failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleShare = async () => {
    const success = await copyShareToken(token);
    if (success) {
      showToast("Link copied! 🔗");
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleMCQAnswer = (questionIndex, option) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionIndex]: option }));
  };

  const checkMCQResults = () => {
    setShowResults(true);
  };

  const renderContent = () => {
    if (!resource) return null;

    switch (resource.contentType) {
      case "pdf":
        return resource.fileUrl ? (
          <PdfReader
            fileUrl={resource.fileUrl}
            title={resource.title}
            initialFullscreen={true}
            resourceId={resource.id}
            initialPage={initialPage}
            onBack={onBack || (() => {
              window.dispatchEvent(new CustomEvent("sc-open-research-hub"));
              navigate("/app");
            })}
          />
        ) : (
          <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "40px", textAlign: "center", color: "#4a5080" }}>
            PDF not available
          </div>
        );

      case "note":
        return (
          <div
            style={{
              background: "#0d0f20",
              border: "0.5px solid #1e2245",
              borderRadius: "10px",
              padding: "16px",
              fontSize: "14px",
              color: "#7b82b8",
              lineHeight: 1.7,
            }}
          >
            <strong style={{ color: "#c5c9e8", fontSize: "16px" }}>{resource.title}</strong>
            {resource.description && <p style={{ marginTop: 8, marginBottom: 8 }}>{resource.description}</p>}
            {resource.fileUrl ? (
              <iframe
                src={`${API_BASE}/api/resources/proxy-pdf?url=${encodeURIComponent(resource.fileUrl)}&token=${encodeURIComponent(JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken || "")}`}
                title={resource.title}
                style={{ width: "100%", height: "400px", border: "none", borderRadius: "8px", marginTop: 12, background: "#0a0c1e" }}
              />
            ) : resource.description ? (
              <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", color: "#c5c9e8", fontSize: 13, lineHeight: 1.7 }}>
                {resource.description}
              </pre>
            ) : (
              <p style={{ marginTop: 12, color: "#3a3d60" }}>Content not available.</p>
            )}
          </div>
        );

      case "mcq":
        return <McqQuizRunner resource={resource} onBack={handleBack} onQuizComplete={onQuizComplete} />;

      case "tutorial_question":
        return (
          <div
            style={{
              background: "#0d0f20",
              border: "0.5px solid #1e2245",
              borderRadius: "10px",
              padding: "16px",
              fontSize: "14px",
              color: "#7b82b8",
              lineHeight: 1.9,
            }}
          >
            <strong style={{ color: "#c5c9e8", fontSize: "16px" }}>{resource.title}</strong>
            <br />
            <br />
            {resource.description || "Tutorial questions will be displayed here."}
          </div>
        );

      default:
        return <div style={{ color: "#7b82b8" }}>Content type not supported</div>;
    }
  };

  const renderAuthOverlay = () => {
    return (
      <div style={{ position: "relative", marginTop: "8px" }}>
        {/* Blurred content */}
        <div
          style={{
            background: "#0d0f20",
            border: "0.5px solid #1e2245",
            borderRadius: "10px",
            height: "200px",
            filter: "blur(4px)",
            opacity: 0.4,
            marginBottom: "-200px",
          }}
        />

        {/* Auth card */}
        <div
          style={{
            background: "#0d0f20",
            border: "0.5px solid #2a3080",
            borderRadius: "12px",
            padding: "20px",
            position: "relative",
            zIndex: 2,
            margin: "0 8px",
          }}
        >
          {authCase === "guest" ? (
            <>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#e8eaf6", marginBottom: "4px" }}>Log in to continue</div>
              <div style={{ fontSize: "12px", color: "#4a5080", marginBottom: "16px", lineHeight: 1.4 }}>
                You need an account to view this resource.
              </div>
              {authError && <div style={{ fontSize: "12px", color: "#ef9a9a", background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "6px", padding: "8px 10px", marginBottom: "8px" }}>{authError}</div>}
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email or username"
                  required
                  style={{
                    width: "100%",
                    background: "#0a0c1e",
                    border: "0.5px solid #1e2245",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: "#9fa8da",
                    outline: "none",
                  }}
                />
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  required
                  style={{
                    width: "100%",
                    background: "#0a0c1e",
                    border: "0.5px solid #1e2245",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: "#9fa8da",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#1a237e",
                    border: "0.5px solid #3949ab",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#c5cae9",
                    cursor: authLoading ? "not-allowed" : "pointer",
                    opacity: authLoading ? 0.4 : 1,
                  }}
                >
                  {authLoading ? "Logging in..." : "Log in & Open Resource"}
                </button>
              </form>
              <div
                onClick={() => setAuthCase("new")}
                style={{ textAlign: "center", fontSize: "11px", color: "#3a3d60", marginTop: "12px", cursor: "pointer" }}
              >
                No account? <span style={{ color: "#5c6bc0" }}>Sign up free →</span>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#e8eaf6", marginBottom: "4px" }}>Quick access — free</div>
              <div style={{ fontSize: "12px", color: "#4a5080", marginBottom: "16px", lineHeight: 1.4 }}>
                Create a free account. Get 3 free resource opens.
              </div>
              {authError && <div style={{ fontSize: "12px", color: "#ef9a9a", background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "6px", padding: "8px 10px", marginBottom: "8px" }}>{authError}</div>}
              <form onSubmit={handleQuickSignup} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Username (no spaces, e.g. john_doe)"
                  required
                  style={{
                    width: "100%",
                    background: "#0a0c1e",
                    border: "0.5px solid #1e2245",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: "#9fa8da",
                    outline: "none",
                  }}
                />
                <input
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="Email address"
                  required
                  style={{
                    width: "100%",
                    background: "#0a0c1e",
                    border: "0.5px solid #1e2245",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: "#9fa8da",
                    outline: "none",
                  }}
                />
                <input
                  type="password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  placeholder="Password (min 8 characters)"
                  required
                  style={{
                    width: "100%",
                    background: "#0a0c1e",
                    border: "0.5px solid #1e2245",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "13px",
                    color: "#9fa8da",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#1a237e",
                    border: "0.5px solid #3949ab",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#c5cae9",
                    cursor: authLoading ? "not-allowed" : "pointer",
                    opacity: authLoading ? 0.4 : 1,
                  }}
                >
                  {authLoading ? "Creating account..." : "Continue to Resource →"}
                </button>
              </form>
              <div
                onClick={() => setAuthCase("guest")}
                style={{ textAlign: "center", fontSize: "11px", color: "#3a3d60", marginTop: "12px", cursor: "pointer" }}
              >
                Have an account? <span style={{ color: "#5c6bc0" }}>Log in</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "14px", color: "#7b82b8" }}>Loading resource...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <div style={{ fontSize: "16px", color: "#ef9a9a", marginBottom: "12px" }}>{error}</div>
        <button
          onClick={handleBack}
          style={{
            padding: "10px 20px",
            background: "#1a237e",
            border: "0.5px solid #3949ab",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#9fa8da",
            cursor: "pointer",
          }}
        >
          Back to Research Hub
        </button>
      </div>
    );
  }

  if (!resource) return null;

  const badgeColor = getSubjectBadgeColor(resource.subject);
  const icon = getContentTypeIcon(resource.contentType);
  const iconClass = getContentTypeIconClass(resource.contentType);
  // Use trial info from logView response
  const isPremiumResource = resource?.isPremium || trialInfo?.isPremium || false;
  const allowed = trialInfo ? trialInfo.allowed : (user?.isActivated ?? true);

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={handleBack}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          background: "#111328",
          border: "0.5px solid #2a2d4a",
          borderRadius: "8px",
          fontSize: "13px",
          color: "#7b82b8",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        ← Back
      </button>

      {/* Resource Info */}
      <div
        style={{
          background: "#0d0f20",
          border: "0.5px solid #1e2245",
          borderRadius: "10px",
          padding: "14px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            background: iconClass === "icon-pdf" ? "#2a0a0a" : 
                     iconClass === "icon-mcq" ? "#0f1440" :
                     iconClass === "icon-note" ? "#0f2a1a" : "#1a1000",
            border: iconClass === "icon-pdf" ? "0.5px solid #4a1010" :
                    iconClass === "icon-mcq" ? "0.5px solid #2a3080" :
                    iconClass === "icon-note" ? "0.5px solid #1a4a2a" : "0.5px solid #3a2800",
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "15px", fontWeight: 600, color: "#c5c9e8", marginBottom: "2px" }}>{resource.title}</div>
          <div style={{ fontSize: "11px", color: "#4a5080" }}>
            <span
              style={{
                padding: "2px 8px",
                borderRadius: "6px",
                background: badgeColor.bg,
                color: badgeColor.text,
                border: `0.5px solid ${badgeColor.border}`,
                marginRight: "6px",
              }}
            >
              {resource.subject}
            </span>
            {resource.viewCount} views
            {resource.isPremium && " · ⭐ Premium"}
          </div>
        </div>
      </div>

      {/* Premium paywall — non-activated user trying to view a premium resource */}
      {authCase === "loggedin" && isPremiumResource && !allowed && (
        <div style={{ background: "linear-gradient(135deg,#0d0820,#1a0828)", border: "0.5px solid #5c35a0", borderRadius: "14px", padding: "28px 24px", marginBottom: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px" }}>🔒</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>Premium Resource</div>
          <div style={{ fontSize: "13px", color: "#9fa8da", marginBottom: "8px", lineHeight: 1.6 }}>
            This is a <strong>premium resource</strong> — upgrade to access all premium notes, PDFs & MCQs.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", marginTop: "20px" }}>
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent("sc-open-premium")); if (onBack) onBack(); navigate("/app#upgrade"); }}
              style={{ padding: "12px 32px", background: "linear-gradient(135deg,#5c35a0,#1a237e)", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer", width: "100%", maxWidth: "280px" }}
            >
              💎 Upgrade to Premium
            </button>
            <div style={{ fontSize: "11px", color: "#4a5080" }}>Starting from ₦700/week · Cancel anytime</div>
          </div>
        </div>
      )}

      {/* Content or Auth Overlay */}
      {authCase === "loggedin" && (allowed || (!trialInfo && !isPremiumResource)) ? (
        <div style={{ marginBottom: "16px" }}>{renderContent()}</div>
      ) : authCase !== "loggedin" ? (
        <div style={{ marginBottom: "16px" }}>{renderAuthOverlay()}</div>
      ) : null}

      {/* Share button */}
      {authCase === "loggedin" && (allowed || (!trialInfo && !isPremiumResource)) && (
        <button
          onClick={handleShare}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px",
            background: "#0f1128",
            border: "0.5px solid #252860",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 600,
            color: "#7986cb",
          }}
        >
          🔗 Share this resource
        </button>
      )}

      {/* Ratings & Comments */}
      {authCase === "loggedin" && (allowed || (!trialInfo && !isPremiumResource)) && resource?.id && (
        <RatingsAndComments resourceId={resource.id} />
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "8px", padding: "12px", fontSize: "13px", color: "#ef9a9a", marginTop: "16px" }}>
          {error}
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: "24px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#0f2a1a",
            border: "0.5px solid #2a6a3a",
            color: "#a5d6a7",
            padding: "10px 20px",
            borderRadius: "20px",
            fontSize: "13px",
            fontWeight: 600,
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            animation: "fadeup 0.2s ease",
          }}
        >
          <span>✓</span>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes fadeup {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}
