import { useState, useEffect } from "react";
import { toast } from "./Toast";
import { api } from "../lib/appUtils";
import WelcomePaywall from "./WelcomePaywall";

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
      return (s.username || "").toLowerCase().includes(q) || (s.email || "").toLowerCase().includes(q) || (s.activationKey || "").toLowerCase().includes(q);
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

export function LockedScreen({ activationKey, username, userRole, onLogout, onTryFreeTier, onRefresh, isChecking, onGetPremium, deferredPrompt, onInstall, isIOS }) {
  const isFaculty = userRole === "TEACHER" || userRole === "LECTURER";

  if (isFaculty) {
    return (
      <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
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
    <WelcomePaywall
      username={username}
      activationKey={activationKey}
      onLogout={onLogout}
      onTryFreeTier={onTryFreeTier}
      onRefresh={onRefresh}
      isChecking={isChecking}
      onGetPremium={onGetPremium}
      deferredPrompt={deferredPrompt}
      onInstall={onInstall}
      isIOS={isIOS}
    />
  );
}
