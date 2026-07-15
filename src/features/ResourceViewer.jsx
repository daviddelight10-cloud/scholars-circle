import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, copyShareToken } from "../lib/researchUtils";
import PdfReader from "./PdfReader.jsx";
import DocumentReader from "./DocumentReader.jsx";
import McqQuizRunner from "./McqQuizRunner.jsx";
import FlashcardDeckRunner from "./FlashcardDeckRunner.jsx";
import RatingsAndComments from "../components/RatingsAndComments.jsx";

import { API_BASE } from "../lib/constants";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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
            folderId={resource.folderId}
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

      case "image":
      case "docx":
      case "txt":
      case "pptx":
        return resource.fileUrl ? (
          <DocumentReader
            fileUrl={resource.fileUrl}
            title={resource.title}
            contentType={resource.contentType}
            resourceId={resource.id}
            folderId={resource.folderId}
            onBack={onBack || (() => {
              window.dispatchEvent(new CustomEvent("sc-open-research-hub"));
              navigate("/app");
            })}
          />
        ) : (
          <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "40px", textAlign: "center", color: "#4a5080" }}>
            Document not available
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
        return <McqQuizRunner resource={resource} shareToken={resource.shareToken} onBack={handleBack} onQuizComplete={onQuizComplete} />;

      case "flashcard_deck":
        return <FlashcardDeckRunner resource={resource} onBack={handleBack} onStreakUpdate={onQuizComplete} />;

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
                    color: "#DAA520",
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
                    color: "#DAA520",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#1a1a1a",
                    border: "0.5px solid #B8860B",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#FFD700",
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
                    color: "#DAA520",
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
                    color: "#DAA520",
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
                    color: "#DAA520",
                    outline: "none",
                  }}
                />
                <button
                  type="submit"
                  disabled={authLoading}
                  style={{
                    width: "100%",
                    padding: "10px",
                    background: "#1a1a1a",
                    border: "0.5px solid #B8860B",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#FFD700",
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
            background: "#1a1a1a",
            border: "0.5px solid #B8860B",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            color: "#DAA520",
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
          <div style={{ fontSize: "13px", color: "#DAA520", marginBottom: "8px", lineHeight: 1.6 }}>
            This is a <strong>premium resource</strong> — upgrade to access all premium notes, PDFs & MCQs.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", alignItems: "center", marginTop: "20px" }}>
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent("sc-open-premium")); if (onBack) onBack(); navigate("/app#upgrade"); }}
              style={{ padding: "12px 32px", background: "linear-gradient(135deg,#5c35a0,#1a1a1a)", border: "none", borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer", width: "100%", maxWidth: "280px" }}
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

      {/* Share button — not rendered for MCQ or flashcard decks (they own their own back/share) */}
      {authCase === "loggedin" && resource?.contentType !== "mcq" && resource?.contentType !== "flashcard_deck" && (allowed || (!trialInfo && !isPremiumResource)) && (
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

      {/* Study with Voice Tutor — for file-based resources */}
      {authCase === "loggedin" && ["pdf", "docx", "pptx", "txt"].includes(resource?.contentType) && (allowed || (!trialInfo && !isPremiumResource)) && (
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("sc-open-voice-tutor", { detail: { resourceId: resource.id } }));
          }}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px",
            marginTop: "10px",
            background: "linear-gradient(135deg, rgba(79,124,255,0.15), #0f1128)",
            border: "0.5px solid rgba(79,124,255,0.4)",
            borderRadius: "10px",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 700,
            color: "#4f7cff",
          }}
        >
          🎙️ Study with Voice Tutor
        </button>
      )}

      {/* Ratings & Comments — not rendered for MCQ or flashcard decks */}
      {authCase === "loggedin" && resource?.contentType !== "mcq" && resource?.contentType !== "flashcard_deck" && (allowed || (!trialInfo && !isPremiumResource)) && resource?.id && (
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
