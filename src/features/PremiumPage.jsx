import { useState, useEffect, useRef } from "react";

const PAYSTACK_PUBLIC_KEY = "pk_live_xxxxxxxxxxxxxxxxxxxx"; // Replace with your Paystack public key
const OPAY_ACCOUNT = "9069372522";
const OPAY_NAME = "Zibiri-David Delight Aluaye";
const WHATSAPP_LINK = "https://wa.link/yj2em4";
const WHATSAPP_NUMBER = "09028617178";

const PLANS = [
  { id: "week1", label: "1 Week", price: 700,  desc: "Perfect for trying out",    color: "#3b82f6", icon: "⚡" },
  { id: "week2", label: "2 Weeks", price: 1300, desc: "Save ₦100",                color: "#8b5cf6", icon: "🔥" },
  { id: "month1", label: "1 Month", price: 2400, desc: "Save ₦400 — Best Value",  color: "#10b981", icon: "💎", best: true },
];

export default function PremiumPage({ user, token, isActivated, onActivated, onClose }) {
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState(null); // "paystack" | "transfer"
  const [paying, setPaying] = useState(false);
  const [toast, setToast] = useState(null);
  const paystackRef = useRef(null);

  const activationKey = user?.activationKey || "";
  const email = user?.email || user?.username || "";

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  // Load Paystack script
  useEffect(() => {
    if (paymentMethod !== "paystack") return;
    if (document.getElementById("paystack-script")) return;
    const script = document.createElement("script");
    script.id = "paystack-script";
    script.src = "https://js.paystack.co/v1/inline.js";
    script.async = true;
    document.head.appendChild(script);
  }, [paymentMethod]);

  function handlePaystackPay() {
    if (!selectedPlan) return;
    const plan = PLANS.find(p => p.id === selectedPlan);
    if (!plan) return;

    // @ts-ignore
    const handler = window.PaystackPop?.setup({
      key: PAYSTACK_PUBLIC_KEY,
      email: email,
      amount: plan.price * 100, // Paystack uses kobo
      currency: "NGN",
      ref: `SC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      metadata: {
        plan: selectedPlan,
        activationKey: activationKey,
        userId: user?.id || "",
      },
      onClose: () => {
        setPaying(false);
      },
      callback: async (response) => {
        // Payment successful — verify on backend
        setPaying(true);
        try {
          const res = await fetch(
            `${import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app"}/payment/verify`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({
                reference: response.reference,
                plan: selectedPlan,
                activationKey: activationKey,
              }),
            }
          );
          const data = await res.json();
          if (res.ok && data.activated) {
            showToast("✅ Payment successful! Your account is now activated.");
            onActivated?.();
          } else {
            showToast(data.error || "Verification failed. Contact support.", "error");
          }
        } catch {
          showToast("Payment went through but verification failed. Contact support with your reference.", "error");
        }
        setPaying(false);
      },
    });
    handler.openIframe();
  }

  function handleTransferConfirm() {
    if (!selectedPlan) return;
    const plan = PLANS.find(p => p.id === selectedPlan);
    const message = encodeURIComponent(
      `Hi, I've made a transfer for the ${plan.label} plan (₦${plan.price.toLocaleString()}).\n\n` +
      `My Activation Key: ${activationKey}\n` +
      `Amount Paid: ₦${plan.price.toLocaleString()}\n\n` +
      `Here's my payment proof:`
    );
    window.open(`${WHATSAPP_LINK}?text=${message}`, "_blank");
    showToast("📱 Opening WhatsApp. Send your receipt — activation within 2 hours.");
  }

  const container = {
    maxWidth: "640px", margin: "0 auto", padding: "0 0 40px",
  };
  const card = {
    background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "16px",
    padding: "24px", marginBottom: "16px",
  };
  const btnPrimary = (disabled) => ({
    width: "100%", padding: "14px", borderRadius: "12px", border: "none",
    fontSize: "15px", fontWeight: 700, cursor: disabled ? "default" : "pointer",
    background: disabled ? "#1e2245" : "linear-gradient(135deg, #3b82f6, #8b5cf6)",
    color: disabled ? "#4a5080" : "#fff",
    transition: "all 0.2s",
  });

  return (
    <div style={container}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: "20px", right: "20px", zIndex: 9999,
          padding: "12px 20px", borderRadius: "10px", fontWeight: 600, fontSize: "14px",
          background: toast.type === "error" ? "#2a0a0a" : "#0f2a1a",
          color: toast.type === "error" ? "#ef9a9a" : "#a5d6a7",
          border: `0.5px solid ${toast.type === "error" ? "#4a1010" : "#1a5a2a"}`,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: "28px" }}>
        <div style={{ fontSize: "48px", marginBottom: "8px" }}>💎</div>
        <h2 style={{ color: "#e8eaf6", fontSize: "22px", fontWeight: 700, margin: "0 0 6px" }}>
          Upgrade to Premium
        </h2>
        <p style={{ color: "#7b82b8", fontSize: "14px", margin: 0 }}>
          Unlock unlimited practice, AI tutor, analytics & more
        </p>
      </div>

      {/* Status */}
      {isActivated ? (
        <div style={{ ...card, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
          <div style={{ color: "#34d399", fontWeight: 700, fontSize: "16px", marginBottom: "4px" }}>
            Your account is active!
          </div>
          <p style={{ color: "#7b82b8", fontSize: "13px", margin: 0 }}>
            You can still extend your plan below.
          </p>
        </div>
      ) : (
        <div style={{ ...card, background: "rgba(250,204,21,0.06)", border: "1px solid rgba(250,204,21,0.25)", textAlign: "center" }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔑</div>
          <div style={{ color: "#facc15", fontWeight: 700, fontSize: "14px", marginBottom: "8px" }}>
            Your Activation Key
          </div>
          <div style={{
            fontFamily: "monospace", fontSize: "22px", fontWeight: 700, color: "#fbbf24",
            letterSpacing: "3px", background: "rgba(0,0,0,0.3)", padding: "10px 16px",
            borderRadius: "8px", display: "inline-block",
          }}>
            {activationKey || "N/A"}
          </div>
          <p style={{ color: "#7b82b8", fontSize: "12px", marginTop: "10px", marginBottom: 0 }}>
            You'll need this key when making payment
          </p>
        </div>
      )}

      {/* Step 1: Choose Plan */}
      <div style={card}>
        <h3 style={{ color: "#e8eaf6", fontSize: "15px", fontWeight: 700, margin: "0 0 4px" }}>
          Step 1: Choose Your Plan
        </h3>
        <p style={{ color: "#7b82b8", fontSize: "12px", margin: "0 0 16px" }}>
          Select a plan that works for you
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {PLANS.map(plan => {
            const active = selectedPlan === plan.id;
            return (
              <div key={plan.id}
                onClick={() => { setSelectedPlan(plan.id); setPaymentMethod(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "14px 16px", borderRadius: "12px", cursor: "pointer",
                  border: active ? `2px solid ${plan.color}` : "0.5px solid #1e2245",
                  background: active ? `${plan.color}15` : "#0a0b18",
                  transition: "all 0.15s", position: "relative",
                }}
              >
                {plan.best && (
                  <div style={{
                    position: "absolute", top: "-10px", right: "12px",
                    background: "#10b981", color: "#fff", fontSize: "10px",
                    fontWeight: 700, padding: "3px 10px", borderRadius: "20px",
                  }}>BEST VALUE</div>
                )}
                <span style={{ fontSize: "28px" }}>{plan.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#e8eaf6", fontWeight: 700, fontSize: "15px" }}>{plan.label} Plan</div>
                  <div style={{ color: "#4a5080", fontSize: "12px" }}>{plan.desc}</div>
                </div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: plan.color }}>
                  ₦{plan.price.toLocaleString()}
                </div>
                {active && <span style={{ color: plan.color, fontSize: "18px" }}>✓</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 2: Payment Method */}
      {selectedPlan && (
        <div style={card}>
          <h3 style={{ color: "#e8eaf6", fontSize: "15px", fontWeight: 700, margin: "0 0 4px" }}>
            Step 2: Payment Method
          </h3>
          <p style={{ color: "#7b82b8", fontSize: "12px", margin: "0 0 16px" }}>
            Pay online instantly or transfer manually
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "16px" }}>
            {/* Paystack */}
            <div
              onClick={() => setPaymentMethod("paystack")}
              style={{
                padding: "16px", borderRadius: "12px", cursor: "pointer", textAlign: "center",
                border: paymentMethod === "paystack" ? "2px solid #3b82f6" : "0.5px solid #1e2245",
                background: paymentMethod === "paystack" ? "rgba(59,130,246,0.1)" : "#0a0b18",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>💳</div>
              <div style={{ color: "#e8eaf6", fontWeight: 700, fontSize: "13px", marginBottom: "2px" }}>
                Pay Online
              </div>
              <div style={{ color: "#4a5080", fontSize: "11px" }}>
                Card / Bank / USSD
              </div>
              <div style={{
                marginTop: "8px", fontSize: "10px", color: "#34d399",
                background: "rgba(52,211,153,0.1)", padding: "3px 8px",
                borderRadius: "10px", display: "inline-block",
              }}>
                ⚡ Instant Activation
              </div>
            </div>

            {/* Transfer */}
            <div
              onClick={() => setPaymentMethod("transfer")}
              style={{
                padding: "16px", borderRadius: "12px", cursor: "pointer", textAlign: "center",
                border: paymentMethod === "transfer" ? "2px solid #f59e0b" : "0.5px solid #1e2245",
                background: paymentMethod === "transfer" ? "rgba(245,158,11,0.1)" : "#0a0b18",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "6px" }}>🏦</div>
              <div style={{ color: "#e8eaf6", fontWeight: 700, fontSize: "13px", marginBottom: "2px" }}>
                Bank Transfer
              </div>
              <div style={{ color: "#4a5080", fontSize: "11px" }}>
                Opay · Manual
              </div>
              <div style={{
                marginTop: "8px", fontSize: "10px", color: "#f59e0b",
                background: "rgba(245,158,11,0.1)", padding: "3px 8px",
                borderRadius: "10px", display: "inline-block",
              }}>
                ⏱️ Up to 2 Hours
              </div>
            </div>
          </div>

          {/* Paystack pay button */}
          {paymentMethod === "paystack" && (
            <button onClick={handlePaystackPay} disabled={paying} style={btnPrimary(paying)}>
              {paying ? "Processing Payment…" : `Pay ₦${PLANS.find(p => p.id === selectedPlan)?.price.toLocaleString()} with Paystack`}
            </button>
          )}

          {/* Transfer details */}
          {paymentMethod === "transfer" && (
            <div>
              <div style={{
                background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)",
                borderRadius: "12px", padding: "16px", marginBottom: "12px",
              }}>
                <div style={{ color: "#f59e0b", fontWeight: 700, fontSize: "13px", marginBottom: "10px" }}>
                  🏦 Transfer to Opay
                </div>
                <div style={{ fontSize: "13px", lineHeight: "2", color: "#c5c9e8" }}>
                  <div><strong style={{ color: "#7b82b8" }}>Bank:</strong> Opay</div>
                  <div><strong style={{ color: "#7b82b8" }}>Account:</strong> {OPAY_ACCOUNT}</div>
                  <div><strong style={{ color: "#7b82b8" }}>Name:</strong> {OPAY_NAME}</div>
                  <div><strong style={{ color: "#7b82b8" }}>Amount:</strong> ₦{PLANS.find(p => p.id === selectedPlan)?.price.toLocaleString()}</div>
                </div>
              </div>

              <div style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: "10px", padding: "12px 14px", marginBottom: "12px",
              }}>
                <div style={{ color: "#ef9a9a", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>
                  ⚠️ Important — Manual Activation
                </div>
                <p style={{ color: "#c5c9e8", fontSize: "12px", margin: 0, lineHeight: "1.6" }}>
                  After transferring, send your payment receipt to WhatsApp along with your activation key. 
                  Your account will be activated <strong style={{ color: "#ef9a9a" }}>within 2 hours</strong>.
                </p>
              </div>

              <button onClick={handleTransferConfirm} style={{
                ...btnPrimary(false),
                background: "linear-gradient(135deg, #25D366, #128C7E)",
              }}>
                💬 Send Receipt on WhatsApp
              </button>
            </div>
          )}
        </div>
      )}

      {/* Features */}
      <div style={card}>
        <h3 style={{ color: "#e8eaf6", fontSize: "15px", fontWeight: 700, margin: "0 0 16px" }}>
          ✨ What You Get with Premium
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          {[
            { icon: "♾️", text: "Unlimited practice questions" },
            { icon: "🤖", text: "AI Tutor access" },
            { icon: "🃏", text: "Spaced repetition flashcards" },
            { icon: "📊", text: "Detailed analytics & insights" },
            { icon: "🎯", text: "Weak area focus mode" },
            { icon: "🏆", text: "XP, streaks & badges" },
            { icon: "📱", text: "Offline access" },
            { icon: "💬", text: "Priority support" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", color: "#c5c9e8", fontSize: "13px" }}>
              <span>{f.icon}</span>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Support */}
      <div style={{ textAlign: "center", padding: "8px 0" }}>
        <p style={{ color: "#4a5080", fontSize: "12px", margin: "0 0 8px" }}>
          Need help? Contact us on WhatsApp
        </p>
        <a
          href={`https://wa.me/234${WHATSAPP_NUMBER.slice(1)}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            padding: "10px 20px", background: "#25D366", color: "#fff",
            borderRadius: "10px", textDecoration: "none", fontWeight: 600,
            fontSize: "13px",
          }}
        >
          💬 Chat on WhatsApp
        </a>
      </div>
    </div>
  );
}
