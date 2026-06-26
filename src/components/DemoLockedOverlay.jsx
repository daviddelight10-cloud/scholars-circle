import React, { useState } from "react";
import { useToast } from "./Toast";

export function DemoLockedOverlay({ title, description, icon = "🔒", features = [], showPlans = false }) {
  const toast = useToast();
  const [selectedPlan, setSelectedPlan] = useState(null);

  const plans = [
    { id: "week1", name: "1 Week Plan", price: "₦700", savings: "Perfect for trying out" },
    { id: "week2", name: "2 Weeks Plan", price: "₦1,300", savings: "Save ₦100" },
    { id: "month1", name: "1 Month Plan", price: "₦2,400", savings: "Save ₦400", highlight: true },
  ];

  const bankDetails = {
    bank: "Opay",
    accountNumber: "9069372522",
    accountName: "Zibiri-David Delight Aluaye",
  };

  return (
    <div className="card" style={{ textAlign: "center", padding: "32px 24px", maxWidth: 500, margin: "0 auto", background: "var(--card-bg, #1e293b)", border: "1px solid var(--border-color, #334155)" }}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
      <h2 style={{ margin: "0 0 8px 0", fontSize: 20, color: "var(--text-primary, #f1f5f9)" }}>⭐ Premium Feature</h2>
      <h3 style={{ margin: "0 0 12px 0", fontSize: 16, color: "var(--text-primary, #f1f5f9)" }}>{title}</h3>
      <p style={{ marginBottom: 20, lineHeight: 1.5, fontSize: 13, color: "var(--text-secondary, #cbd5e1)" }}>{description}</p>

      {features.length > 0 && (
        <div style={{ background: "var(--success-bg, rgba(45,212,160,0.1))", borderRadius: 10, padding: 16, marginBottom: 20, textAlign: "left", border: "1px solid var(--success-border, rgba(45,212,160,0.3))" }}>
          <strong style={{ color: "var(--success-text, #2dd4a0)", display: "block", marginBottom: 10, fontSize: 13 }}>✨ What you'll unlock:</strong>
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, fontSize: 12, color: "var(--text-primary, #f1f5f9)" }}>
            {features.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>
      )}

      {showPlans && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ marginBottom: 12, fontSize: 13, color: "var(--text-secondary, #cbd5e1)" }}>Choose a plan that works for you:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {plans.map((plan) => (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan.id)}
                style={{
                  border: selectedPlan === plan.id ? "2px solid var(--accent-color, #3b82f6)" : "1px solid var(--border-color, #334155)",
                  borderRadius: 10,
                  padding: 14,
                  cursor: "pointer",
                  background: selectedPlan === plan.id ? "var(--selected-bg, rgba(59,130,246,0.1))" : "var(--item-bg, rgba(255,255,255,0.05))",
                  transition: "all 0.2s",
                  position: "relative"
                }}
              >
                {plan.highlight && (
                  <div style={{ position: "absolute", top: -8, right: 10, background: "#10b981", color: "white", fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>BEST VALUE</div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary, #f1f5f9)" }}>{plan.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>{plan.savings}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "var(--accent-color, #3b82f6)" }}>{plan.price}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showPlans && selectedPlan && (
        <div style={{ background: "var(--selected-bg, rgba(59,130,246,0.1))", border: "1px solid var(--accent-color, rgba(59,130,246,0.3))", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: 13, color: "var(--text-primary, #f1f5f9)" }}>🏦 Payment Details</h4>
          <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--text-secondary, #cbd5e1)" }}>
            <div><strong>Bank:</strong> {bankDetails.bank}</div>
            <div><strong>Account Number:</strong> {bankDetails.accountNumber}</div>
            <div><strong>Account Name:</strong> {bankDetails.accountName}</div>
            <div><strong>Amount:</strong> {plans.find(p => p.id === selectedPlan)?.price}</div>
          </div>
        </div>
      )}

      {showPlans && selectedPlan && (
        <div style={{ background: "var(--warning-bg, rgba(251,191,36,0.1))", border: "1px solid var(--warning-border, rgba(251,191,36,0.3))", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <h4 style={{ margin: "0 0 10px 0", fontSize: 13, color: "var(--text-primary, #f1f5f9)" }}>📱 After Payment</h4>
          <p style={{ fontSize: 11, marginBottom: 10, color: "var(--text-secondary, #cbd5e1)" }}>
            Send a screenshot of your payment receipt to our WhatsApp to activate:
          </p>
          <a
            href={`https://wa.link/yj2em4?text=${encodeURIComponent(`Hi, I've made a payment for ${plans.find(p => p.id === selectedPlan)?.name}. Here's my payment proof:`)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              textAlign: "center",
              background: "#25D366",
              color: "white",
              textDecoration: "none",
              padding: "10px",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 13
            }}
          >
            💬 Send Payment Proof on WhatsApp
          </a>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <button
          onClick={() => {
            if (showPlans && !selectedPlan) {
              toast.warning("Please select a plan first");
              return;
            }
            if (!selectedPlan) {
              toast.info(`🚀 Upgrade to access ${title}!`);
            }
          }}
          style={{
            background: "var(--accent-color, #3b82f6)",
            color: "white",
            fontWeight: 600,
            padding: "12px 24px",
            fontSize: 14,
            border: "none",
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          {selectedPlan ? `Pay ${plans.find(p => p.id === selectedPlan)?.price}` : "Upgrade Now"}
        </button>
        <button
          onClick={() => toast.info("🎁 Start your 14-day free trial today! No credit card required.")}
          style={{
            background: "transparent",
            border: "1px solid var(--border-color, #334155)",
            color: "var(--text-primary, #f1f5f9)",
            padding: "10px 20px",
            fontSize: 13,
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          Free Trial
        </button>
      </div>
    </div>
  );
}

export default DemoLockedOverlay;
