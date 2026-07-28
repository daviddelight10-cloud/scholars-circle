import React, { useEffect, useState } from "react";

/**
 * Floating "Install Scholar's Circle" prompt.
 * - Captures the browser's `beforeinstallprompt` event on Chrome/Edge/Android
 * - Shows custom UI with iOS-specific instructions when needed
 * - Auto-hides if app is already installed or the user dismisses
 */
const DISMISS_KEY = "sc_install_dismissed_at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isAndroid() {
  return /Android/i.test(navigator.userAgent);
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_COOLDOWN_MS) return;

    function onBeforeInstall(e) {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    }
    function onInstalled() {
      setVisible(false);
      setDeferredPrompt(null);
      localStorage.removeItem(DISMISS_KEY);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);

    function onDismissed() {
      setVisible(false);
      setDeferredPrompt(null);
    }
    window.addEventListener("pwa-install-dismissed", onDismissed);

    // iOS doesn't fire beforeinstallprompt — show our manual instructions after a short delay
    if (isIOS()) {
      const t = setTimeout(() => setVisible(true), 5000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.removeEventListener("appinstalled", onInstalled);
        window.removeEventListener("pwa-install-dismissed", onDismissed);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("pwa-install-dismissed", onDismissed);
    };
  }, []);

  if (!visible || isStandalone()) return null;

  async function handleInstall() {
    if (!deferredPrompt) return; // iOS: no programmatic install
    setInstalling(true);
    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      } else {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        setVisible(false);
      }
      setDeferredPrompt(null);
      window.__deferredPrompt = null;
      window.dispatchEvent(new CustomEvent('pwa-install-dismissed'));
    } finally {
      setInstalling(false);
    }
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }

  const ios = isIOS();
  const android = isAndroid();

  return (
    <div style={{
      position: "fixed",
      top: "calc(env(safe-area-inset-top, 0px) + 12px)",
      left: 12,
      right: 12,
      maxWidth: 460,
      margin: "0 auto",
      zIndex: 1090,
      padding: 12,
      borderRadius: 12,
      background: "linear-gradient(135deg, #0f172a, #1e293b)",
      border: "1px solid rgba(255,215,0,0.4)",
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      color: "#fff",
      fontSize: 13,
      lineHeight: 1.4
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <img src="/loading.png" alt="" style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>
            Install Scholar's Circle
          </div>
          <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 2 }}>
            {ios && "Tap Share → Add to Home Screen for the best experience + push notifications."}
            {android && deferredPrompt && "One-tap install for quick access and offline study."}
            {!ios && !android && "Install for quick access from your desktop or app drawer."}
          </div>

          {ios && (
            <div style={{ marginTop: 8, padding: 8, borderRadius: 6, background: "rgba(255,255,255,0.05)", fontSize: 11, color: "#FFD700" }}>
              <b>How:</b> Open Safari → tap the <b>Share</b> button at the bottom → scroll down → tap <b>"Add to Home Screen"</b>.
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {deferredPrompt && !ios && (
              <button onClick={handleInstall} disabled={installing} style={primaryBtn}>
                {installing ? "Installing…" : "📥 Install"}
              </button>
            )}
            <button onClick={dismiss} style={secondaryBtn}>
              {ios ? "Got it" : "Not now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const primaryBtn = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #FFD700, #DAA520)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer"
};

const secondaryBtn = {
  padding: "8px 16px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.2)",
  background: "transparent",
  color: "#cbd5e1",
  fontSize: 13,
  cursor: "pointer"
};
