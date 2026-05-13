import React, { useEffect, useState } from "react";
import { lecturersApi } from "./api.js";

export function LecturerProfileView({ lecturerId, token, onBack, onMessage, currentUser }) {
  const [lecturer, setLecturer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRate, setShowRate] = useState(false);
  const [score, setScore] = useState(5);
  const [comment, setComment] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    lecturersApi.get(lecturerId, token)
      .then((d) => { if (alive) { setLecturer(d); setError(null); } })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [lecturerId, token]);

  async function submitRating() {
    try {
      await lecturersApi.rate(lecturerId, score, comment, token);
      setShowRate(false);
      setComment("");
      // Refresh
      const refreshed = await lecturersApi.get(lecturerId, token);
      setLecturer(refreshed);
    } catch (e) {
      alert("Failed to rate: " + e.message);
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading profile...</div>;
  if (error) return <div style={{ padding: 16, background: "rgba(239,68,68,0.1)", color: "#f87171", borderRadius: 8 }}>{error}</div>;
  if (!lecturer) return null;

  const isOwn = currentUser?.id === lecturer.userId;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <button onClick={onBack} style={{ marginBottom: 16, padding: "8px 14px", borderRadius: 8, background: "rgba(30,41,59,0.6)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)", cursor: "pointer" }}>
        ← Back to Directory
      </button>

      {/* Hero */}
      <div className="card" style={{ padding: 24, marginBottom: 16, background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div
            style={{
              width: 110,
              height: 110,
              borderRadius: "50%",
              background: lecturer.avatarUrl ? `url(${lecturer.avatarUrl}) center/cover` : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 44,
              color: "#fff",
              fontWeight: 700,
              flexShrink: 0
            }}
          >
            {!lecturer.avatarUrl && (lecturer.fullName?.charAt(0) || "?")}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h2 style={{ margin: 0, fontSize: 24, display: "flex", alignItems: "center", gap: 8 }}>
              {lecturer.title ? `${lecturer.title} ` : ""}{lecturer.fullName}
              {lecturer.isVerified && <span title="Verified" style={{ fontSize: 18 }}>✅</span>}
            </h2>
            <div style={{ color: "#a5b4fc", marginTop: 4 }}>
              {lecturer.department}{lecturer.institution && ` · ${lecturer.institution}`}
            </div>
            {lecturer.yearsExperience && (
              <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{lecturer.yearsExperience}+ years experience</div>
            )}

            {lecturer.bio && (
              <p style={{ marginTop: 12, color: "#cbd5e1", lineHeight: 1.6 }}>{lecturer.bio}</p>
            )}

            <div style={{ display: "flex", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
              <div style={{ fontSize: 14, color: "#fbbf24" }}>
                ⭐ {(lecturer.rating || 0).toFixed(1)}/5 <span style={{ color: "#9ca3af", fontSize: 12 }}>({lecturer.totalRatings} ratings)</span>
              </div>
              {!isOwn && (
                <>
                  <button onClick={() => onMessage?.(lecturer)} style={primaryBtn}>💬 Message</button>
                  <button onClick={() => setShowRate(true)} style={ghostBtn}>⭐ Rate</button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rate Modal */}
      {showRate && (
        <div className="card" style={{ padding: 16, marginBottom: 16, background: "rgba(30,41,59,0.95)" }}>
          <h3 style={{ marginTop: 0 }}>Rate this lecturer</h3>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                style={{
                  fontSize: 28,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  color: n <= score ? "#fbbf24" : "#475569"
                }}
              >★</button>
            ))}
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment..."
            rows={3}
            style={{ width: "100%", padding: 10, borderRadius: 8, background: "rgba(15,23,42,0.8)", color: "#fff", border: "1px solid rgba(99,102,241,0.3)", marginBottom: 12, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShowRate(false)} style={ghostBtn}>Cancel</button>
            <button onClick={submitRating} style={primaryBtn}>Submit Rating</button>
          </div>
        </div>
      )}

      {/* Sections */}
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "1fr" }}>
        {(lecturer.qualifications?.length > 0) && (
          <Section title="🎓 Qualifications">
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {lecturer.qualifications.map((q, i) => <li key={i} style={{ marginBottom: 4 }}>{q}</li>)}
            </ul>
          </Section>
        )}

        {(lecturer.researchAreas?.length > 0) && (
          <Section title="🔬 Research Areas">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {lecturer.researchAreas.map((r) => (
                <span key={r} style={{ padding: "4px 10px", background: "rgba(99,102,241,0.2)", color: "#a5b4fc", borderRadius: 99, fontSize: 12 }}>{r}</span>
              ))}
            </div>
          </Section>
        )}

        {lecturer.officeHours && Object.keys(lecturer.officeHours).length > 0 && (
          <Section title="🕐 Office Hours">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {Object.entries(lecturer.officeHours).map(([day, time]) => (
                  <tr key={day}>
                    <td style={{ padding: 6, color: "#a5b4fc", textTransform: "capitalize" }}>{day}</td>
                    <td style={{ padding: 6 }}>{time || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lecturer.officeLocation && <div style={{ marginTop: 8, fontSize: 12, color: "#9ca3af" }}>📍 {lecturer.officeLocation}</div>}
          </Section>
        )}

        {(lecturer.contactEmail || lecturer.phone || lecturer.websiteUrl || lecturer.linkedinUrl) && (
          <Section title="📞 Contact">
            <div style={{ display: "grid", gap: 8 }}>
              {lecturer.contactEmail && <div>📧 <a href={`mailto:${lecturer.contactEmail}`} style={{ color: "#a5b4fc" }}>{lecturer.contactEmail}</a></div>}
              {lecturer.phone && <div>📱 {lecturer.phone}</div>}
              {lecturer.websiteUrl && <div>🌐 <a href={lecturer.websiteUrl} target="_blank" rel="noreferrer" style={{ color: "#a5b4fc" }}>{lecturer.websiteUrl}</a></div>}
              {lecturer.linkedinUrl && <div>💼 <a href={lecturer.linkedinUrl} target="_blank" rel="noreferrer" style={{ color: "#a5b4fc" }}>LinkedIn</a></div>}
            </div>
          </Section>
        )}

        {lecturer.posts?.length > 0 && (
          <Section title="📝 Recent Posts">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {lecturer.posts.map((p) => (
                <div key={p.id} style={{ padding: 12, background: "rgba(15,23,42,0.6)", borderRadius: 8 }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.title}</div>
                  <div style={{ fontSize: 13, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>{p.content}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>{new Date(p.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {lecturer.ratings?.length > 0 && (
          <Section title="💬 Recent Reviews">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {lecturer.ratings.map((r) => (
                <div key={r.id} style={{ padding: 10, background: "rgba(15,23,42,0.6)", borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ color: "#fbbf24" }}>{"★".repeat(r.score)}{"☆".repeat(5 - r.score)}</span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>by {r.student?.username || "Anonymous"}</span>
                  </div>
                  {r.comment && <div style={{ fontSize: 13, color: "#cbd5e1" }}>{r.comment}</div>}
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="card">
      <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

const primaryBtn = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13
};

const ghostBtn = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(99,102,241,0.4)",
  background: "transparent",
  color: "#a5b4fc",
  cursor: "pointer",
  fontSize: 13
};
