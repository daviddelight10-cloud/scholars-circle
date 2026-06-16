import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, copyShareToken } from "../lib/researchUtils";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:4000";

export default function ResourceViewer() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [authCase, setAuthCase] = useState("loggedin"); // loggedin | guest | new
  const [user, setUser] = useState(null);
  const [toast, setToast] = useState(null);

  // Auth form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // MCQ state
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showResults, setShowResults] = useState(false);

  useEffect(() => {
    fetchResource();
    checkAuth();
  }, [token]);

  const checkAuth = () => {
    const authData = localStorage.getItem("scholars-circle-auth");
    if (authData) {
      try {
        const parsed = JSON.parse(authData);
        if (parsed.authUser) {
          setUser(parsed.authUser);
          setAuthCase("loggedin");
          return;
        }
      } catch (e) {}
    }
    setAuthCase("guest");
  };

  const fetchResource = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/resources/${token}`);
      if (response.ok) {
        const data = await response.json();
        setResource(data);
      } else if (response.status === 404) {
        setError("Resource not found");
      }
    } catch (err) {
      setError("Failed to load resource");
    } finally {
      setLoading(false);
    }
  };

  const logView = async () => {
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      await fetch(`${API_BASE}/api/resources/${token}/view`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: authData.authUser?.id || null,
          guestToken: null,
        }),
      });
    } catch (err) {
      console.error("Failed to log view:", err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("scholars-circle-auth", JSON.stringify(data));
        setUser(data.authUser);
        setAuthCase("loggedin");
        logView();
      } else {
        setError(data.error || "Login failed");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleQuickSignup = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: signupName,
          email: `${signupName.toLowerCase().replace(/\s/g, "")}@temp.local`,
          password: signupPassword,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        localStorage.setItem("scholars-circle-auth", JSON.stringify(data));
        setUser(data.authUser);
        setAuthCase("loggedin");
        logView();
      } else {
        setError(data.error || "Signup failed");
      }
    } catch (err) {
      setError("Signup failed. Please try again.");
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
        return (
          <div
            style={{
              background: "#0a0c1e",
              border: "0.5px solid #1e2245",
              borderRadius: "10px",
              height: "500px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
            }}
          >
            <span style={{ fontSize: "48px" }}>📄</span>
            <div style={{ fontSize: "14px", color: "#4a5080" }}>{resource.title}.pdf</div>
            <div style={{ fontSize: "12px", color: "#2e3260" }}>PDF Viewer</div>
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: "8px 20px",
                background: "#1a237e",
                border: "0.5px solid #3949ab",
                borderRadius: "20px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#9fa8da",
                textDecoration: "none",
                cursor: "pointer",
              }}
            >
              Open PDF
            </a>
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
            <br />
            <br />
            {resource.description || "Note content will be displayed here."}
          </div>
        );

      case "mcq":
        const questions = resource.mcqData || [];
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", fontWeight: 600, color: "#c5c9e8" }}>
                {questions.length} Questions
              </span>
              {!showResults && (
                <button
                  onClick={checkMCQResults}
                  style={{
                    padding: "8px 16px",
                    background: "#1a237e",
                    border: "0.5px solid #3949ab",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#9fa8da",
                    cursor: "pointer",
                  }}
                >
                  Check Answers
                </button>
              )}
            </div>
            {questions.map((q, i) => {
              const selected = selectedAnswers[i];
              const isCorrect = selected === q.correct;
              const showResult = showResults || selected;

              return (
                <div
                  key={i}
                  style={{
                    background: "#0d0f20",
                    border: "0.5px solid #1e2245",
                    borderRadius: "10px",
                    padding: "14px",
                  }}
                >
                  <div style={{ fontSize: "11px", color: "#3a3d60", marginBottom: "6px", fontWeight: 600 }}>
                    Question {i + 1}
                  </div>
                  <div style={{ fontSize: "13px", color: "#c5c9e8", lineHeight: 1.5, marginBottom: "12px" }}>
                    {q.question}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {Object.entries(q.options).map(([key, value]) => {
                      const isSelected = selected === key;
                      const isCorrectOption = key === q.correct;
                      const isWrongSelection = isSelected && !isCorrectOption && showResult;

                      return (
                        <div
                          key={key}
                          onClick={() => !showResults && handleMCQAnswer(i, key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "0.5px solid #1e2245",
                            cursor: showResults ? "default" : "pointer",
                            background: isWrongSelection
                              ? "#2a0f0f"
                              : isCorrectOption && showResult
                              ? "#0f2a1a"
                              : isSelected
                              ? "#0f1240"
                              : "transparent",
                            borderColor: isWrongSelection
                              ? "#6a2a2a"
                              : isCorrectOption && showResult
                              ? "#2a6a3a"
                              : "#1e2245",
                            color: isWrongSelection
                              ? "#ef9a9a"
                              : isCorrectOption && showResult
                              ? "#a5d6a7"
                              : "#7b82b8",
                          }}
                        >
                          <div
                            style={{
                              width: "20px",
                              height: "20px",
                              borderRadius: "5px",
                              background: "#12142a",
                              border: "0.5px solid #252860",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              fontWeight: 700,
                              color: "#5a6090",
                            }}
                          >
                            {key}
                          </div>
                          <span style={{ fontSize: "12px" }}>{value}</span>
                          {showResult && isCorrectOption && <span style={{ marginLeft: "auto" }}>✓</span>}
                          {showResult && isSelected && !isCorrectOption && <span style={{ marginLeft: "auto" }}>✗</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );

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
              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="Email"
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
              <div style={{ fontSize: "16px", fontWeight: 700, color: "#e8eaf6", marginBottom: "4px" }}>Quick access</div>
              <div style={{ fontSize: "12px", color: "#4a5080", marginBottom: "16px", lineHeight: 1.4 }}>
                Create a free account. No email needed to get started.
              </div>
              <form onSubmit={handleQuickSignup} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Your name"
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
                  placeholder="Choose a password"
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
          onClick={() => navigate("/resources")}
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
  const remainingViews = user ? user.freeTrialLimit - user.freeTrialViews : 0;

  return (
    <div style={{ padding: "20px", maxWidth: "900px", margin: "0 auto" }}>
      {/* Back button */}
      <button
        onClick={() => navigate("/resources")}
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

      {/* Free trial banner */}
      {authCase === "loggedin" && user && user.freeTrialViews < user.freeTrialLimit && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#1a1000",
            border: "0.5px solid #3a2800",
            borderRadius: "8px",
            padding: "10px 12px",
            marginBottom: "16px",
            fontSize: "12px",
            color: "#ffb74d",
          }}
        >
          <span>✨</span>
          Free preview: {remainingViews} resource{remainingViews !== 1 ? "s" : ""} remaining
        </div>
      )}

      {/* Upgrade prompt */}
      {authCase === "loggedin" && user && user.freeTrialViews >= user.freeTrialLimit && (
        <div
          style={{
            background: "#1a0808",
            border: "0.5px solid #4a1010",
            borderRadius: "10px",
            padding: "20px",
            marginBottom: "16px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#ef9a9a", marginBottom: "8px" }}>
            Free trial limit reached
          </div>
          <div style={{ fontSize: "13px", color: "#ef9a9a", marginBottom: "16px" }}>
            You've viewed {user.freeTrialLimit} free resources. Upgrade to continue accessing premium content.
          </div>
          <button
            style={{
              padding: "10px 24px",
              background: "#1a237e",
              border: "0.5px solid #3949ab",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#c5cae9",
              cursor: "pointer",
            }}
          >
            Upgrade Now
          </button>
        </div>
      )}

      {/* Content or Auth Overlay */}
      {authCase === "loggedin" && (user.freeTrialViews < user.freeTrialLimit || !user.freeTrialLimit) ? (
        <div style={{ marginBottom: "16px" }}>{renderContent()}</div>
      ) : authCase === "loggedin" && user.freeTrialViews >= user.freeTrialLimit ? (
        <div style={{ marginBottom: "16px" }}>{renderAuthOverlay()}</div>
      ) : (
        <div style={{ marginBottom: "16px" }}>{renderAuthOverlay()}</div>
      )}

      {/* Share button */}
      {authCase === "loggedin" && (user.freeTrialViews < user.freeTrialLimit || !user.freeTrialLimit) && (
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
