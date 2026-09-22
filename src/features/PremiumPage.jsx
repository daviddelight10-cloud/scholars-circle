import { useState } from "react";
import PaystackPop from "@paystack/inline-js";
import "./settings/settings.css";
import { toast } from "../components/Toast";
import { PLANS, getPlan, planLabel, naira } from "../lib/plans";

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || "pk_test_2c321f6a4471b672ee716506912ede6f6f99d8cd";
const OPAY_ACCOUNT = "9069372522";
const OPAY_NAME = "Zibiri-David Delight Aluaye";
const WHATSAPP_LINK = "https://wa.link/yj2em4";

export default function PremiumPage({ user, token, isActivated, onActivated, onNavigate, onBack }) {
  const [selectedPlan, setSelectedPlan] = useState("semester");
  const [paymentMethod, setPaymentMethod] = useState("paystack");
  const [paying, setPaying] = useState(false);

  const activationKey = user?.activationKey || "";
  const email = user?.email || user?.username || "";
  const plan = getPlan(selectedPlan);

  const expiry = user?.activationExpiry ? new Date(user.activationExpiry) : null;
  const daysLeft = expiry ? Math.max(0, Math.ceil((expiry - Date.now()) / 86400000)) : null;

  function copyTxt(t) {
    if (navigator.clipboard) navigator.clipboard.writeText(t).catch(() => {});
    toast.success("📋 Copied: " + t);
  }

  function verifyPayment(reference) {
    setPaying(true);
    const BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";
    fetch(`${BASE}/payment/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify({ reference, plan: selectedPlan, activationKey }),
    })
      .then(res => res.json().then(data => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (ok && data.activated) {
          // Update stored token if server returned a new one
          if (data.token) {
            try {
              const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
              authData.authToken = data.token;
              localStorage.setItem("scholars-circle-auth", JSON.stringify(authData));
            } catch {}
          }
          toast.success("✅ Payment successful! Your account is now activated.");
          onActivated?.();
        } else {
          toast.error(data.error || "Verification failed. Contact support.");
        }
      })
      .catch(() => {
        toast.error("Payment went through but verification failed. Contact support.");
      })
      .finally(() => setPaying(false));
  }

  function handlePaystackPay() {
    if (!plan) return;

    // Paystack requires a valid email — use a fallback if user only has a username
    const payEmail = email.includes("@") ? email : `${email || "user"}@scholars-circle.app`;

    try {
      const popup = new PaystackPop();
      popup.newTransaction({
        key: PAYSTACK_PUBLIC_KEY,
        email: payEmail,
        amount: plan.price * 100, // Paystack uses kobo
        currency: "NGN",
        reference: `SC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        metadata: {
          plan: selectedPlan,
          activationKey: activationKey,
          userId: user?.id || "",
        },
        onSuccess: (transaction) => {
          verifyPayment(transaction.reference);
        },
        onCancel: () => {
          setPaying(false);
        },
      });
    } catch (err) {
      console.error("Paystack error:", err);
      toast.error(`Payment error: ${err.message || "Unknown error"}. Please refresh and try again.`);
    }
  }

  function handleTransferConfirm() {
    if (!plan) return;
    const message = encodeURIComponent(
      `Hi, I've made a transfer for the ${plan.label} plan (${naira(plan.price)}).\n\n` +
      `My Activation Key: ${activationKey}\n` +
      `Amount Paid: ${naira(plan.price)}\n\n` +
      `Here's my payment proof:`
    );
    window.open(`${WHATSAPP_LINK}?text=${message}`, "_blank");
    toast.info("📱 Opening WhatsApp. Send your receipt — activation within 2 hours.");
  }

  function handlePay() {
    if (paymentMethod === "bank") {
      handleTransferConfirm();
    } else {
      handlePaystackPay();
    }
  }

  return (
    <div className="st-root">
      <div className="st-fabrow">
        <button className="st-exitfab st-press" onClick={onBack || (() => {})} aria-label="Back">← Back</button>
      </div>

      {/* Hero */}
      <section className="st-phero">
        <div className="st-glow" />
        <div className="st-dia">💎</div>
        <h2>ScholarsCircle <span>Premium</span></h2>
        <p>
          {isActivated
            ? "You have everything unlocked. Extend below — days stack automatically."
            : "Unlimited practice, AI tutor, analytics & more — built for scholars who want first class."}
        </p>
      </section>

      {/* Free plan status */}
      {!isActivated && (
        <section className="st-fstat">
          <div className="st-lock">
            <span>🔒</span>
            <div>
              <b>You're on the Free plan</b>
              <div className="st-sub2">Upgrade below — activation is instant with Paystack.</div>
            </div>
          </div>
          <div className="st-uhead">
            <span>Activation key</span>
            <b style={{ fontFamily: "'Courier New', monospace", letterSpacing: 2 }}>{activationKey || "N/A"}</b>
          </div>
          <div className="st-lockgrid">
            <div className="st-litem">🤖 AI Tutor — locked</div>
            <div className="st-litem">📊 Analytics — locked</div>
            <div className="st-litem">🃏 Flashcards — locked</div>
            <div className="st-litem">🎯 Weak-area mode — locked</div>
          </div>
        </section>
      )}

      {/* Active plan status */}
      {isActivated && expiry && (
        <section className="st-pstat">
          <div className="st-ok">
            <span>✅</span>
            <div>
              ScholarsCircle Premium — Active!
              <div className="st-sub2">Thanks for supporting us 💛</div>
            </div>
          </div>
          <div className="st-pbar">
            <i style={{
              width: `${Math.min(100, Math.max(0, Math.round((1 - daysLeft / (plan?.days || 30)) * 100)))}%`,
            }} />
          </div>
          <div className="st-pbar-l">
            <span>started {new Date(user?.activatedAt || Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
            <span>{daysLeft} days left</span>
          </div>
          <div className="st-pgrid">
            <div className="st-pbox"><span>Plan</span><b>{planLabel(user?.planType) || "Active"}</b></div>
            <div className="st-pbox"><span>Days left</span><b className="st-g">{daysLeft}</b></div>
            <div className="st-pbox"><span>Expires</span><b>{expiry.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b></div>
          </div>
        </section>
      )}

      {/* Plans */}
      <div className="st-glabel" style={{ paddingLeft: 14, marginTop: 16 }}>
        {isActivated ? "Extend / change plan" : "Choose your plan"}
      </div>
      <div style={{ padding: "0 14px" }}>
        {PLANS.map((p) => (
          <button
            key={p.id}
            className={`st-plan st-press${selectedPlan === p.id ? " st-sel" : ""}`}
            onClick={() => setSelectedPlan(p.id)}
          >
            {p.best && <span className="st-bestv">BEST VALUE</span>}
            <span className="st-p-ic">{p.icon}</span>
            <span className="st-nm">
              <b>{p.label} Plan</b>
              <small>{p.note}</small>
              <span className="st-pd">⚡ ₦{Math.round(p.price / p.days)}/day</span>
            </span>
            <span className="st-pr"><b>{naira(p.price)}</b><small>one-time</small></span>
            <span className="st-chk">✓</span>
          </button>
        ))}
      </div>

      {/* Payment method */}
      <div className="st-glabel" style={{ paddingLeft: 14, marginTop: 18 }}>Payment method</div>
      <div className="st-pm">
        <div
          className={`st-pmc st-press${paymentMethod === "paystack" ? " st-sel" : ""}`}
          onClick={() => setPaymentMethod("paystack")}
        >
          <span className="st-radio" />
          <div className="st-pm-ic">💳</div>
          <b>Pay Online</b>
          <small>Card · Bank · USSD</small>
          <div className="st-tag st-fast">⚡ Instant</div>
        </div>
        <div
          className={`st-pmc st-press${paymentMethod === "bank" ? " st-sel" : ""}`}
          onClick={() => setPaymentMethod("bank")}
        >
          <span className="st-radio" />
          <div className="st-pm-ic">🏦</div>
          <b>Bank Transfer</b>
          <small>Opay · Manual</small>
          <div className="st-tag st-slow">⏱ Up to 2 hrs</div>
        </div>
      </div>

      {/* Bank transfer details */}
      {paymentMethod === "bank" && plan && (
        <>
          <div className="st-bank">
            <h4>🏦 Transfer to Opay</h4>
            <div className="st-brow"><span className="st-k">Bank</span><span className="st-v">Opay</span></div>
            <div className="st-brow">
              <span className="st-k">Account</span>
              <span className="st-v">{OPAY_ACCOUNT}</span>
              <button className="st-copy st-press" onClick={() => copyTxt(OPAY_ACCOUNT)}>Copy</button>
            </div>
            <div className="st-brow"><span className="st-k">Name</span><span className="st-v">{OPAY_NAME}</span></div>
            <div className="st-brow">
              <span className="st-k">Amount</span>
              <span className="st-v" style={{ color: "var(--st-accent)" }}>{naira(plan.price)}</span>
              <button className="st-copy st-press" onClick={() => copyTxt(String(plan.price))}>Copy</button>
            </div>
          </div>
          <div className="st-note">
            ⚠️ <b>Manual activation.</b> After transferring, send your receipt + activation key to WhatsApp on the button below. Activated within <b>2 hours</b>.
          </div>
        </>
      )}

      {/* Trust row */}
      <div className="st-trust">
        <span>🔒 Secured by Paystack</span>
        <span>⚡ Instant activation</span>
        <span>🛡 Trusted by scholars</span>
      </div>

      {/* Benefits */}
      <section className="st-benefits">
        <h4>✨ What you get with Premium</h4>
        <div className="st-bgrid">
          <div className="st-bitem"><span className="st-tick">✓</span>Unlimited practice questions</div>
          <div className="st-bitem"><span className="st-tick">✓</span>AI Tutor access</div>
          <div className="st-bitem"><span className="st-tick">✓</span>Spaced repetition flashcards</div>
          <div className="st-bitem"><span className="st-tick">✓</span>Detailed analytics & insights</div>
          <div className="st-bitem"><span className="st-tick">✓</span>Weak-area focus mode</div>
          <div className="st-bitem"><span className="st-tick">✓</span>XP, streaks & badges</div>
          <div className="st-bitem"><span className="st-tick">✓</span>Offline access</div>
          <div className="st-bitem"><span className="st-tick">✓</span>Priority support</div>
        </div>
      </section>

      {/* Referral mini card */}
      {onNavigate && (
        <button className="st-refmini st-press" onClick={() => onNavigate("refer")}>
          🎁 <span>Get <b>3 free days</b> — invite a friend, you both win</span>
          <span className="st-chev">›</span>
        </button>
      )}

      <p className="st-help">
        Already paid but not activated? <button onClick={() => window.open(WHATSAPP_LINK, "_blank")}>Contact support</button>
      </p>

      {/* Sticky pay button */}
      <div className="st-paywrap">
        <button
          className={`st-paybtn st-press${paymentMethod === "bank" ? " st-wa" : ""}`}
          onClick={handlePay}
          disabled={paying}
        >
          {paymentMethod === "bank"
            ? "💬 I've Paid — Send Receipt on WhatsApp"
            : paying
            ? "Processing…"
            : `${isActivated ? "Extend · " : "Pay "}${naira(plan?.price || 0)} with Paystack ⚡`}
        </button>
      </div>
    </div>
  );
}
