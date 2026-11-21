import React from "react";
import { openPremium } from "../lib/premium.js";

// Small lock chip that marks a Premium-only control. Tap opens the payment
// modal with the matching feature headline. Wrap a locked row with
// `onClick`/`role="button"` styling already handled by callers — this is just
// the inline badge.
export function PremiumLock({ feature, label = "Premium" }) {
  return (
    <button
      type="button"
      className="prem-lock"
      onClick={(e) => { e.stopPropagation(); openPremium(feature); }}
      aria-label={`${label} — Premium feature`}
    >
      🔒 {label}
    </button>
  );
}

export default PremiumLock;
