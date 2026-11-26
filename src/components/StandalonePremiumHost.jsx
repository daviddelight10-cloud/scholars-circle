import { useEffect, useState } from "react";
import PaymentModal from "./PaymentModal.jsx";
import { ensureAppSession } from "../lib/authToken.js";
import { toast } from "./Toast";

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
  } catch {
    return {};
  }
}

/**
 * Paywall host for routes outside the /app shell — App.jsx's sc-open-premium
 * listener isn't mounted there, so openPremium() calls (Page Tutor gates,
 * exam insight locks, resource upgrades…) would fire into the void. Mounted
 * once globally by AppRouter on every route that doesn't self-host.
 */
export default function StandalonePremiumHost() {
  const [feature, setFeature] = useState(null);
  const [auth, setAuth] = useState(getAuth);

  useEffect(() => {
    const onOpen = (e) => {
      setAuth(getAuth()); // payment metadata may have changed since mount
      setFeature(e?.detail?.feature || "premium");
    };
    window.addEventListener("sc-open-premium", onOpen);
    return () => window.removeEventListener("sc-open-premium", onOpen);
  }, []);

  const onActivated = async () => {
    const u = await ensureAppSession({ revalidate: true });
    if (u) {
      setAuth(getAuth());
      toast.success("✅ Your account has been activated! Welcome aboard!");
      // Surfaces holding their own premium state can refresh on this.
      try { window.dispatchEvent(new CustomEvent("sc:premium-activated")); } catch {}
    }
  };

  return (
    <PaymentModal
      open={feature !== null}
      feature={feature}
      onClose={() => setFeature(null)}
      user={auth.authUser}
      token={auth.authToken}
      onActivated={onActivated}
    />
  );
}
