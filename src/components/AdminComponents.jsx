import React, { useState, useEffect } from "react";
import { toast } from "./Toast";
import { api } from "../lib/appUtils";

export function KeyManagement({ token }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showActivateModal, setShowActivateModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState("month1");

  async function loadStudents() {
    setLoading(true);
    try {
      const data = await api("/keys/students", { token });
      setStudents(data);
    } catch (e) {
      console.error("Failed to load students:", e);
    }
    setLoading(false);
  }

  useEffect(() => { loadStudents(); }, []);

  async function activate(userId, duration = "month1") {
    try {
      await api(`/keys/activate/${userId}`, { token, method: "POST", body: { duration } });
      loadStudents();
      setShowActivateModal(false);
      setSelectedStudent(null);
      setSelectedDuration("month1");
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function deactivate(userId) {
    try {
      await api(`/keys/deactivate/${userId}`, { token, method: "POST" });
      loadStudents();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const filtered = students.filter((s) => {
    if (filter === "pending" && s.isActivated) return false;
    if (filter === "activated" && !s.isActivated) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.username.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || (s.activationKey || "").toLowerCase().includes(q);
    }
    return true;
  });

  const pendingCount = students.filter((s) => !s.isActivated).length;
  const activeCount = students.filter((s) => s.isActivated).length;

  return (
    <div className="card">
      <h2>🔑 Student Key Management</h2>
      <p className="muted">{students.length} students total · <strong style={{ color: "#facc15" }}>{pendingCount} pending</strong> · <strong style={{ color: "#34d399" }}>{activeCount} activated</strong></p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or key..."
          style={{ flex: 1, minWidth: 180 }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Students</option>
          <option value="pending">Pending Activation</option>
          <option value="activated">Activated</option>
        </select>
        <button onClick={loadStudents} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {loading && !students.length ? (
        <p className="muted">Loading students...</p>
      ) : filtered.length === 0 ? (
        <p className="muted">No students found.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                <th style={{ padding: "8px 6px" }}>Student</th>
                <th style={{ padding: "8px 6px" }}>Key</th>
                <th style={{ padding: "8px 6px" }}>Status</th>
                <th style={{ padding: "8px 6px" }}>Days Left</th>
                <th style={{ padding: "8px 6px" }}>Activated</th>
                <th style={{ padding: "8px 6px" }}>Joined</th>
                <th style={{ padding: "8px 6px" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "8px 6px" }}>
                    <strong>{s.username}</strong>
                    <br />
                    <span className="muted" style={{ fontSize: 11 }}>{s.email}</span>
                  </td>
                  <td style={{ padding: "8px 6px", fontFamily: "monospace", letterSpacing: 1, color: "#facc15" }}>
                    {s.activationKey || "—"}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {s.isExpired ? (
                      <span style={{ color: "#f87171", fontWeight: 600 }}>● Expired</span>
                    ) : s.isActivated ? (
                      <span style={{ color: "#34d399", fontWeight: 600 }}>● Active</span>
                    ) : (
                      <span style={{ color: "#f87171", fontWeight: 600 }}>○ Pending</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {s.isExpired ? (
                      <span style={{
                        background: "linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.1))",
                        border: "1px solid rgba(239, 68, 68, 0.4)",
                        padding: "4px 8px",
                        borderRadius: 6,
                        color: "#f87171",
                        fontWeight: 700,
                        fontSize: 12
                      }}>Expired</span>
                    ) : s.daysRemaining !== null ? (
                      <span style={{
                        background: s.daysRemaining <= 3
                          ? "linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(234, 88, 12, 0.1))"
                          : s.daysRemaining <= 7
                          ? "linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.1))"
                          : "linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(22, 163, 74, 0.1))",
                        border: s.daysRemaining <= 3
                          ? "1px solid rgba(249, 115, 22, 0.4)"
                          : s.daysRemaining <= 7
                          ? "1px solid rgba(251, 191, 36, 0.4)"
                          : "1px solid rgba(34, 197, 94, 0.4)",
                        padding: "4px 8px",
                        borderRadius: 6,
                        color: s.daysRemaining <= 3 ? "#f97316" : s.daysRemaining <= 7 ? "#fbbf24" : "#4ade80",
                        fontWeight: 700,
                        fontSize: 12
                      }}>
                        {s.daysRemaining}d
                      </span>
                    ) : (
                      <span style={{ color: "#6b7280", fontSize: 11 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: "8px 6px", fontSize: 11 }}>
                    {s.isActivated && s.activatedAt ? (
                      <>
                        {new Date(s.activatedAt).toLocaleDateString()} {new Date(s.activatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        <br />
                        <span className="muted">by {s.activatedByUsername}</span>
                        {s.planType && (
                          <>
                            <br />
                            <span style={{ color: "#facc15" }}>
                              {s.planType === "week1" ? "1 Week" : s.planType === "week2" ? "2 Weeks" : "1 Month"}
                            </span>
                          </>
                        )}
                        {s.activationExpiry && (
                          <>
                            <br />
                            <span className="muted">
                              Expires: {new Date(s.activationExpiry).toLocaleDateString()}
                            </span>
                          </>
                        )}
                      </>
                    ) : "—"}
                  </td>
                  <td style={{ padding: "8px 6px", fontSize: 11 }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "8px 6px" }}>
                    {s.isActivated ? (
                      <button
                        onClick={() => deactivate(s.id)}
                        style={{ background: "#dc2626", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        onClick={() => { setSelectedStudent(s); setShowActivateModal(true); }}
                        style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontSize: 12 }}
                      >
                        Activate
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showActivateModal && selectedStudent && (
        <div className="modal-overlay" onClick={() => setShowActivateModal(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Activate {selectedStudent.username}</h3>
            <p className="muted" style={{ marginBottom: 16 }}>Select activation duration:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
              <div
                onClick={() => setSelectedDuration("week1")}
                style={{
                  border: selectedDuration === "week1" ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  background: selectedDuration === "week1" ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>1 Week</div>
                    <div className="muted" style={{ fontSize: 12 }}>₦700</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#FFD700" }}>7 days</div>
                </div>
              </div>
              <div
                onClick={() => setSelectedDuration("week2")}
                style={{
                  border: selectedDuration === "week2" ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  background: selectedDuration === "week2" ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.05)",
                  transition: "all 0.2s"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>2 Weeks</div>
                    <div className="muted" style={{ fontSize: 12 }}>₦1,300</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#FFD700" }}>14 days</div>
                </div>
              </div>
              <div
                onClick={() => setSelectedDuration("month1")}
                style={{
                  border: selectedDuration === "month1" ? "2px solid #FFD700" : "1px solid rgba(255,255,255,0.2)",
                  borderRadius: 12,
                  padding: 16,
                  cursor: "pointer",
                  background: selectedDuration === "month1" ? "rgba(255,215,0,0.1)" : "rgba(255,255,255,0.05)",
                  transition: "all 0.2s",
                  position: "relative"
                }}
              >
                <div style={{ position: "absolute", top: -10, right: 10, background: "#10b981", color: "white", fontSize: 10, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>POPULAR</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>1 Month</div>
                    <div className="muted" style={{ fontSize: 12 }}>₦2,400</div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "#FFD700" }}>30 days</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setShowActivateModal(false); setSelectedStudent(null); setSelectedDuration("month1"); }}
                style={{ background: "transparent", color: "white", border: "1px solid rgba(255,255,255,0.3)", padding: "10px 20px", borderRadius: 6, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                onClick={() => activate(selectedStudent.id, selectedDuration)}
                style={{ background: "#16a34a", color: "white", border: "none", padding: "10px 20px", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}
              >
                Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function LockedScreen({ activationKey, username, userRole, onLogout, onTryDemo, onRefresh, isChecking, onGetPremium, deferredPrompt, onInstall, isIOS }) {
  const [showActivationKey, setShowActivationKey] = useState(false);

  const isFaculty = userRole === "TEACHER" || userRole === "LECTURER";

  if (isFaculty) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card" style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 12 }}>✅</div>
          <h2>Account Created Successfully!</h2>
          <p className="muted" style={{ marginBottom: 24 }}>
            Welcome, <strong>{username}</strong>! Your {userRole?.toLowerCase()} account is ready to use.
          </p>
          <button onClick={onRefresh} style={{ padding: "12px 32px", background: "#FFD700", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 16, fontWeight: 600 }}>
            Continue to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "linear-gradient(135deg, rgba(255,215,0,0.05), rgba(218,165,32,0.05))" }}>
      <div style={{ maxWidth: 900, width: "100%" }}>
        {/* Install App Button - Top Right */}
        {deferredPrompt && !isIOS && (
          <div style={{ position: "absolute", top: 16, right: 16 }}>
            <button
              onClick={onInstall}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, #DAA520, #FFD700)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 8,
                boxShadow: "0 4px 12px rgba(218,165,32,0.3)"
              }}
            >
              <span>📱</span>
              <span>Install App</span>
            </button>
          </div>
        )}
        {/* iOS Install Instructions */}
        {isIOS && (
          <div style={{ position: "absolute", top: 16, right: 16 }}>
            <div style={{
              padding: "10px 16px",
              background: "rgba(218,165,32,0.1)",
              border: "1px solid rgba(218,165,32,0.3)",
              borderRadius: 8,
              fontSize: 12,
              color: "#DAA520",
              maxWidth: 200,
              textAlign: "center"
            }}>
              Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install
            </div>
          </div>
        )}
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 72, marginBottom: 16 }}>🎓</div>
          <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Welcome to Scholar's Circle!</h1>
          <p className="muted" style={{ fontSize: 16 }}>Hi <strong>{username}</strong>, choose how you want to get started</p>
        </div>
        {/* Two equal option cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, marginBottom: 24 }}>
          {/* Premium Card */}
          <div className="card" style={{
            padding: 24,
            textAlign: "center",
            background: "linear-gradient(135deg, rgba(255,215,0,0.1), rgba(218,165,32,0.1))",
            border: "2px solid rgba(255,215,0,0.3)",
            position: "relative"
          }}>
            <div style={{ position: "absolute", top: 12, right: 12, background: "#FFD700", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              MOST POPULAR
            </div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Premium Access</h3>
            <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>Unlimited access to all features</p>
            {/* Pricing */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 800, color: "#FFD700" }}>₦700</span>
                <span className="muted" style={{ fontSize: 14 }}>/week</span>
              </div>
              <div className="muted" style={{ fontSize: 12 }}>
                or ₦1,300/2 weeks • ₦2,400/month
              </div>
            </div>
            {/* Features */}
            <ul style={{ textAlign: "left", fontSize: 13, marginBottom: 24, lineHeight: 2, listStyle: "none", padding: 0 }}>
              <li>✓ Unlimited practice questions</li>
              <li>✓ Unlimited AI Tutor access</li>
              <li>✓ All subjects & past papers</li>
              <li>✓ Advanced analytics</li>
              <li>✓ Priority support</li>
            </ul>
            <button
              onClick={onGetPremium}
              style={{
                width: "100%",
                padding: "14px 24px",
                background: "linear-gradient(135deg, #FFD700, #DAA520)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 700,
                boxShadow: "0 4px 14px rgba(255,215,0,0.4)",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(255,215,0,0.5)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(255,215,0,0.4)";
              }}
            >
              Get Premium Access
            </button>
          </div>
          {/* Free Trial Card */}
          <div className="card" style={{
            padding: 24,
            textAlign: "center",
            background: "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(5,150,105,0.1))",
            border: "2px solid rgba(16,185,129,0.3)",
            position: "relative"
          }}>
            <div style={{ position: "absolute", top: 12, right: 12, background: "#10b981", color: "#fff", padding: "4px 12px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
              FREE
            </div>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚀</div>
            <h3 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>2-Day Free Trial</h3>
            <p className="muted" style={{ fontSize: 14, marginBottom: 20 }}>Full access for 48 hours</p>
            {/* Daily limits */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 36, fontWeight: 800, color: "#10b981", marginBottom: 8 }}>Free</div>
              <div className="muted" style={{ fontSize: 12 }}>
                2 days of full access
              </div>
            </div>
            {/* Features */}
            <ul style={{ textAlign: "left", fontSize: 13, marginBottom: 24, lineHeight: 2, listStyle: "none", padding: 0 }}>
              <li>✓ All practice modes</li>
              <li>✓ AI Tutor access</li>
              <li>✓ All subjects unlocked</li>
              <li>✓ No daily limits</li>
              <li>✓ Full features for 2 days</li>
            </ul>
            <button
              onClick={onTryDemo}
              style={{
                width: "100%",
                padding: "14px 24px",
                background: "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 700,
                boxShadow: "0 4px 14px rgba(16,185,129,0.4)",
                transition: "transform 0.2s, box-shadow 0.2s"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(16,185,129,0.5)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 14px rgba(16,185,129,0.4)";
              }}
            >
              Start Free Trial
            </button>
          </div>
        </div>
        {/* Alternative: Activation Key (Collapsible) */}
        <div className="card" style={{ padding: 16, textAlign: "center" }}>
          <button
            onClick={() => setShowActivationKey(!showActivationKey)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
              margin: "0 auto"
            }}
          >
            <span>{showActivationKey ? "▼" : "▶"}</span>
            <span>Have an activation key from your teacher?</span>
          </button>
          {showActivationKey && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)", borderRadius: 10, padding: 16, marginBottom: 16 }}>
                <p className="muted" style={{ fontSize: 12, marginBottom: 4 }}>Your Activation Key</p>
                <div style={{ fontFamily: "monospace", fontSize: 24, fontWeight: 700, color: "#facc15", letterSpacing: 2 }}>
                  {activationKey || "—"}
                </div>
                <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Share this key with your teacher to get activated</p>
              </div>
              <div style={{
                background: "rgba(255,215,0,0.1)",
                border: "1px solid rgba(255,215,0,0.3)",
                borderRadius: 8,
                padding: 10,
                marginBottom: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8
              }}>
                <span style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isChecking ? "#FFD700" : "#22c55e",
                  animation: isChecking ? "pulse 1s infinite" : "none"
                }}></span>
                <span style={{ fontSize: 11, color: isChecking ? "#FFD700" : "#22c55e" }}>
                  {isChecking ? "Checking..." : "Auto-checking every 10s"}
                </span>
              </div>
              <button
                onClick={onRefresh}
                disabled={isChecking}
                style={{
                  padding: "8px 20px",
                  background: "#FFD700",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: isChecking ? "wait" : "pointer",
                  opacity: isChecking ? 0.7 : 1,
                  fontSize: 13
                }}
              >
                {isChecking ? "Checking..." : "Check Activation Now"}
              </button>
            </div>
          )}
        </div>
        {/* Logout */}
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={onLogout} style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, textDecoration: "underline" }}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
