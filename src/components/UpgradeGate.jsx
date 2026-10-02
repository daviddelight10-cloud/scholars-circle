import React from "react";
import { PLANS, naira } from "../lib/plans.js";

// Feature-level upgrade gate for free-tier users. Renders inside a page when a
// feature is premium-only. The CTA opens the real payment modal via the
// `sc-open-premium` event (handled in App.jsx).
export function UpgradeGate({ title, description, icon = "🔒", features = [], showPlans = false }) {
  const openPremium = () => window.dispatchEvent(new CustomEvent("sc-open-premium"));

  return (
    <div className="card" style={{ textAlign: "center", padding: "32px 24px", maxWidth: 500, margin: "0 auto", background: "var(--card-bg, #232328)", border: "1px solid var(--border-color, #3a3a40)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <h2 style={{ margin: "0 0 8px 0", fontSize: 20, color: "var(--text-primary, #f1f5f9)" }}>⭐ Premium Feature</h2>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "var(--text-primary, #f1f5f9)" }}>{title}</h3>
      <p style={{ marginBottom: 20, lineHeight: 1.5, fontSize: 13, color: "var(--text-secondary, #cbd5e1)" }}>{description}</p>

      {features.length > 0 && (
        <div style={{ background: "var(--success-bg, rgba(255,215,0,0.1))", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "left", border: "1px solid var(--success-border, rgba(255,215,0,0.3))" }}>
          <strong style={{ color: "var(--success-text, #FFD700)", display: "block", marginBottom: 10, fontSize: 13 }}>✨ What you'll unlock:</strong>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 12, color: "var(--text-primary, #f1f5f9)" }}>
            {features.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      {showPlans && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ marginBottom: 12, fontSize: 13, color: "var(--text-secondary, #cbd5e1)" }}>Choose a plan that works for you:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                style={{
                  border: "1px solid var(--border-color, #3a3a40)",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--item-bg, rgba(255,255,255,0.05))",
                  position: "relative",
                  textAlign: "left",
                }}
              >
                {plan.best && (
                  <div style={{ position: "absolute", top: -8, right: 10, background: "#10b981", color: "white", fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>BEST VALUE</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary, #f1f5f9)" }}>{plan.icon} {plan.label} Plan</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>{plan.note}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-color, #FFD700)" }}>{naira(plan.price)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={openPremium}
          style={{
            background: "var(--accent-color, #FFD700)",
            color: "#111",
            fontWeight: 600,
            padding: "12px 24px",
            fontSize: 14,
            border: "none",
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          Upgrade Now
        </button>
      </div>
    </div>
  );
}

export default UpgradeGate;
