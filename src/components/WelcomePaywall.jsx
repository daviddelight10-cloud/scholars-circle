import { useState } from "react";
import { PLANS, naira } from "../lib/plans";
import "./welcomePaywall.css";

export default function WelcomePaywall({
  username,
  activationKey,
  onLogout,
  onTryFreeTier,
  onRefresh,
  isChecking,
  onGetPremium,
  deferredPrompt,
  onInstall,
  isIOS,
}) {
  const [showActivationKey, setShowActivationKey] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("week1");

  const plan = PLANS.find((p) => p.id === selectedPlan) || PLANS[0];

  return (
    <div className="wp-root">
      <div className="wp-topbar">
        <div className="wp-topbar-left">
          <button className="wp-textlink" onClick={onLogout}>Log out</button>
        </div>
        {deferredPrompt && !isIOS && (
          <button className="wp-install-btn" onClick={onInstall}>
            <span>📱</span>
            <span>Install App</span>
          </button>
        )}
        {isIOS && (
          <div className="wp-ios-pill">
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> to install
          </div>
        )}
      </div>

      <div className="wp-wrap">
        <div className="wp-head">
          <div className="wp-emoji">🎓</div>
          <h1 className="wp-title">Welcome to Scholar's Circle!</h1>
          <p className="wp-subtitle">Hi <strong>{username}</strong>, pick how you'd like to begin</p>
        </div>

        {/* Trial — primary CTA */}
        <div className="wp-card wp-card-trial">
          <div className="wp-badge wp-badge-green">No card required</div>
          <div className="wp-card-icon">🚀</div>
          <h3 className="wp-card-title">Start with a 2-day free trial</h3>
          <p className="wp-card-desc">Full access to every feature for 48 hours.</p>
          <div className="wp-price-row">
            <span className="wp-price wp-price-green">Free</span>
          </div>
          <p className="wp-price-note">Then continue free with daily limits, or upgrade anytime</p>
          <div className="wp-badges">
            <span className="wp-chip">⚡ Instant start</span>
            <span className="wp-chip">🛡 Cancel anytime</span>
            <span className="wp-chip">🎯 Full access</span>
          </div>
          <button className="wp-btn wp-btn-trial" onClick={onTryFreeTier}>
            Start Free Trial →
          </button>
        </div>

        {/* Divider */}
        <div className="wp-divider">or unlock now</div>

        {/* Premium — secondary CTA with plan selector */}
        <div className="wp-card wp-card-premium">
          {plan.best && <div className="wp-badge wp-badge-gold">Best value</div>}
          <div className="wp-card-icon">⭐</div>
          <h3 className="wp-card-title">Go Premium now</h3>
          <p className="wp-card-desc">Unlimited practice, AI tutor, analytics & more.</p>

          <div className="wp-plan-tabs">
            {PLANS.map((p) => (
              <button
                key={p.id}
                className={`wp-plan-tab${selectedPlan === p.id ? " active" : ""}`}
                onClick={() => setSelectedPlan(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="wp-price-row">
            <span className="wp-price wp-price-gold">{naira(plan.price)}</span>
            <span className="wp-price-unit">/{plan.days} days</span>
          </div>
          <p className="wp-price-note">{plan.note}</p>
          <button className="wp-btn wp-btn-premium" onClick={onGetPremium}>
            Get Premium →
          </button>
        </div>

        {/* Benefits */}
        <div className="wp-benefits">
          <h4>Everything included with Premium</h4>
          <div className="wp-benefit-grid">
            <div className="wp-benefit-item"><span className="wp-tick">✓</span> Unlimited practice</div>
            <div className="wp-benefit-item"><span className="wp-tick">✓</span> AI Tutor access</div>
            <div className="wp-benefit-item"><span className="wp-tick">✓</span> All subjects & past papers</div>
            <div className="wp-benefit-item"><span className="wp-tick">✓</span> Spaced-repetition decks</div>
            <div className="wp-benefit-item"><span className="wp-tick">✓</span> Advanced analytics</div>
            <div className="wp-benefit-item"><span className="wp-tick">✓</span> Weak-area focus</div>
            <div className="wp-benefit-item"><span className="wp-tick">✓</span> Offline access</div>
            <div className="wp-benefit-item"><span className="wp-tick">✓</span> Priority support</div>
          </div>
        </div>

        {/* Activation key */}
        <div className="wp-card" style={{ padding: 16 }}>
          <button
            className="wp-activation-trigger"
            onClick={() => setShowActivationKey((v) => !v)}
          >
            <span>{showActivationKey ? "▼" : "▶"}</span>
            <span>Have an activation key from your teacher?</span>
          </button>
          {showActivationKey && (
            <>
              <div className="wp-key-box">
                <p className="wp-key-label">Your Activation Key</p>
                <div className="wp-key-code">{activationKey || "—"}</div>
                <p className="wp-key-hint">Share this key with your teacher to get activated</p>
              </div>
              <div className="wp-status-row">
                <span className={`wp-status-dot${isChecking ? " checking" : " idle"}`} />
                <span style={{ color: isChecking ? "#ffd700" : "#22c55e" }}>
                  {isChecking ? "Checking..." : "Auto-checking every 10s"}
                </span>
              </div>
              <button
                className="wp-check-btn"
                onClick={onRefresh}
                disabled={isChecking}
              >
                {isChecking ? "Checking..." : "Check Activation Now"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
