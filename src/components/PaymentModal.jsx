import { useState } from "react";
import { PLANS, getPlan, naira, waPaymentProofLink } from "../lib/plans.js";
import { PREMIUM_HEADLINES } from "../lib/premium.js";
import { API_BASE } from "../lib/constants";
import { toast } from "./Toast";
import { useModalA11y } from "../hooks/useModalA11y";

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_2c321f6a4471b672ee716506912ede6f6f99d8cd";

/**
 * Shared Premium payment modal — plan picker + Paystack/bank-transfer checkout.
 * Extracted from App.jsx so standalone routes (live-quiz rooms, shared links)
 * can render it too — `openPremium()` fires a window event, so any surface that
 * mounts a listener can show this.
 *
 * Props:
 * - open: whether the modal is shown
 * - feature: PREMIUM_HEADLINES key for the contextual headline
 * - onClose: dismiss
 * - user / token: auth identity for payment metadata + verify calls
 * - onActivated: called after the server confirms activation (refresh auth)
 */
export default function PaymentModal({ open, feature, onClose, user, token, onActivated }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("paystack");

  const a11y = useModalA11y({ isOpen: open, onClose, label: "Upgrade to Premium" });

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10001 }}>
      <div ref={a11y.focusRef} {...a11y.modalProps} className="modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 0 }}>
        {/* Compact header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--app-tint-med)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 16, fontWeight: 700 }}>
            <span>⭐</span> Upgrade
          </div>
          <button onClick={onClose} aria-label="Close dialog" style={{ background: "none", border: "none", color: "#7b82b8", fontSize: 20, cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {/* Feature headline — what the user tried to do when the gate fired */}
          {feature && (
            <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.25)", fontSize: 13, fontWeight: 600, color: "#FFD700", lineHeight: 1.4 }}>
              ⭐ {PREMIUM_HEADLINES[feature] || PREMIUM_HEADLINES.premium}
            </div>
          )}
          {/* Plan picker — horizontal row */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {PLANS.map((p) => (
              <div
                key={p.id}
                onClick={() => { setSelectedPlan(p.id); setPaymentMethod("paystack"); }}
                style={{
                  flex: "1 1 40%",
                  position: "relative",
                  border: selectedPlan === p.id ? "2px solid #FFD700" : "1px solid var(--app-tint-strong)",
                  borderRadius: 10,
                  padding: "12px 8px",
                  cursor: "pointer",
                  background: selectedPlan === p.id ? "rgba(255,215,0,0.1)" : "var(--app-tint-soft)",
                  textAlign: "center",
                  transition: "all 0.2s",
                }}
              >
                {p.best && (
                  <div style={{ position: "absolute", top: -8, left: "50%", transform: "translateX(-50%)", background: "#10b981", color: "var(--app-text)", fontSize: 9, padding: "2px 8px", borderRadius: 10, fontWeight: 700, whiteSpace: "nowrap" }}>BEST VALUE</div>
                )}
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{p.label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#FFD700" }}>{naira(p.price)}</div>
                {selectedPlan === p.id && (
                  <div style={{ position: "absolute", top: 6, right: 6, width: 16, height: 16, borderRadius: "50%", background: "#FFD700", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "var(--app-text)" }}>✓</div>
                )}
              </div>
            ))}
          </div>
          {/* Payment method toggle + content */}
          {selectedPlan && (
            <>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  onClick={() => setPaymentMethod("paystack")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: paymentMethod === "paystack" ? "2px solid #FFD700" : "1px solid var(--app-tint-strong)",
                    background: paymentMethod === "paystack" ? "rgba(255,215,0,0.1)" : "transparent", color: "var(--app-text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >💳 Pay Online</button>
                <button
                  onClick={() => setPaymentMethod("transfer")}
                  style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: paymentMethod === "transfer" ? "2px solid #FFD700" : "1px solid var(--app-tint-strong)",
                    background: paymentMethod === "transfer" ? "rgba(255,215,0,0.1)" : "transparent", color: "var(--app-text)", fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >🏦 Bank Transfer</button>
              </div>
              {/* Paystack */}
              {paymentMethod === "paystack" && (
                <button
                  onClick={async () => {
                    const plan = getPlan(selectedPlan);
                    if (!plan) return;
                    const rawEmail = user?.email || user?.username || "";
                    const payEmail = rawEmail.includes("@") ? rawEmail : `${rawEmail || "user"}@scholars-circle.app`;
                    try {
                      const { default: PaystackPop } = await import("@paystack/inline-js");
                      const popup = new PaystackPop();
                      popup.newTransaction({
                        key: PAYSTACK_PUBLIC_KEY,
                        email: payEmail,
                        amount: plan.price * 100,
                        currency: "NGN",
                        reference: `SC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        metadata: { plan: selectedPlan, activationKey: user?.activationKey || "", userId: user?.id || "" },
                        onSuccess: (transaction) => {
                          fetch(`${API_BASE}/payment/verify`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
                            body: JSON.stringify({ reference: transaction.reference, plan: selectedPlan, activationKey: user?.activationKey || "" }),
                          })
                            .then(res => res.json().then(data => ({ ok: res.ok, data })))
                            .then(({ ok, data }) => {
                              if (ok && data.activated) {
                                onActivated?.();
                                onClose();
                              }
                            })
                            .catch(() => {});
                        },
                        onCancel: () => {},
                      });
                    } catch (err) {
                      toast.error(`Payment error: ${err.message || "Unknown error"}. Please refresh and try again.`);
                    }
                  }}
                  style={{
                    width: "100%", padding: "14px", borderRadius: 10, border: "none",
                    fontSize: 15, fontWeight: 700, cursor: "pointer",
                    background: "linear-gradient(135deg, #FFD700, #DAA520)", color: "var(--app-text)",
                  }}
                >💳 Pay {naira(getPlan(selectedPlan)?.price)} → Instant Activation</button>
              )}
              {/* Bank Transfer */}
              {paymentMethod === "transfer" && (
                <div>
                  <div style={{ background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", borderRadius: 10, padding: 12, marginBottom: 10, fontSize: 13, lineHeight: 1.7 }}>
                    <div><strong>Bank:</strong> Opay</div>
                    <div><strong>Account:</strong> 9069372522</div>
                    <div><strong>Name:</strong> Zibiri-David Delight Aluaye</div>
                    <div><strong>Amount:</strong> {naira(getPlan(selectedPlan)?.price)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--c-9fa8da)", marginBottom: 8, textAlign: "center" }}>
                    Activation key: <span style={{ fontFamily: "monospace", fontWeight: 700, color: "#fbbf24", letterSpacing: 1 }}>{user?.activationKey || "N/A"}</span>
                  </div>
                  <a
                    href={waPaymentProofLink(selectedPlan, user)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block", textAlign: "center", background: "#25D366", color: "var(--app-text)",
                      textDecoration: "none", padding: "12px", borderRadius: 8, fontWeight: 600, fontSize: 14,
                    }}
                  >💬 Send Payment Proof on WhatsApp</a>
                  <div style={{ fontSize: 10, color: "#4a5080", textAlign: "center", marginTop: 8 }}>Manual activation may take up to 2 hours</div>
                </div>
              )}
            </>
          )}
          {/* Footer */}
          <div style={{ marginTop: 16, textAlign: "center", fontSize: 11, color: "#4a5080" }}>
            Cancel anytime — <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={onClose}>Close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
