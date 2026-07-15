import React, { useEffect, useState } from "react";
import {
  isPushSupported,
  isIOS,
  isStandalone,
  getPermission,
  subscribeToPush,
  unsubscribeFromPush,
  hasActiveSubscription,
  sendTestPush,
  sendMotivationNow,
  getNotificationPreferences,
  saveNotificationPreferences,
  listDevices,
  removeDevice
} from "../lib/pushClient.js";

const CATEGORIES = [
  { key: "announcements", icon: "📢", label: "Announcements", desc: "New classroom announcements" },
  { key: "liveSessions", icon: "🔴", label: "Live Sessions", desc: "Alerts when a class goes live" },
  { key: "assignments", icon: "📝", label: "Assignments", desc: "New assignments and due-date reminders" },
  { key: "directMessages", icon: "💬", label: "Messages", desc: "Direct messages from peers and lecturers" },
  { key: "studyReminders", icon: "⏰", label: "Study Reminders", desc: "Smart reminders for your study plan" }
];

const SUPPRESS_KEY = "sc_push_banner_suppressed";

/**
 * Floating banner shown after login if push isn't enabled yet.
 * Auto-dismisses if the user has either subscribed or explicitly dismissed.
 */
export function PushPermissionBanner({ token }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) return;
      if (localStorage.getItem(SUPPRESS_KEY) === "1") return;
      const perm = getPermission();
      if (perm === "granted") {
        const active = await hasActiveSubscription();
        if (!cancelled && !active) setVisible(true);
        return;
      }
      if (perm === "denied") return;
      // default permission: show banner
      if (!cancelled) setVisible(true);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!visible) return null;

  // iOS-specific advice: must install PWA first
  const iosNeedsInstall = isIOS() && !isStandalone();

  async function handleEnable() {
    setStatus("loading");
    setError(null);
    try {
      const res = await subscribeToPush(token);
      if (res.ok) {
        setStatus("ok");
        setTimeout(() => setVisible(false), 1500);
      } else if (res.reason === "ios_needs_install") {
        setStatus("error");
        setError("On iPhone/iPad, you must first install Scholar's Circle (Share → Add to Home Screen), then open the installed app to enable notifications.");
      } else if (res.reason === "denied") {
        setStatus("error");
        setError("Notifications are blocked. Open your browser settings to allow them, then try again.");
      } else {
        setStatus("error");
        setError(res.reason || "Failed to enable notifications.");
      }
    } catch (e) {
      setStatus("error");
      setError(e.message);
    }
  }

  function handleDismiss() {
    localStorage.setItem(SUPPRESS_KEY, "1");
    setVisible(false);
  }

  return (
    <div style={{
      position: "fixed",
      bottom: "calc(env(safe-area-inset-bottom, 0px) + 80px)",
      left: 12,
      right: 12,
      maxWidth: 480,
      margin: "0 auto",
      zIndex: 1100,
      padding: 14,
      borderRadius: 14,
      background: "linear-gradient(135deg, rgba(255,215,0,0.95), rgba(218,165,32,0.95))",
      color: "#fff",
      boxShadow: "0 14px 40px rgba(10,10,10,0.45)",
      backdropFilter: "blur(10px)",
      fontSize: 14,
      lineHeight: 1.4
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>🔔</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Stay in the loop</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 4 }}>
            {iosNeedsInstall
              ? "On iPhone/iPad: tap Share → \"Add to Home Screen\". Open the installed app to turn on alerts for announcements, live classes & messages."
              : "Enable push notifications for announcements, live class alerts, assignments, and direct messages."}
          </div>

          {error && (
            <div style={{ marginTop: 8, fontSize: 12, padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.2)" }}>
              ⚠️ {error}
            </div>
          )}
          {status === "ok" && (
            <div style={{ marginTop: 8, fontSize: 12, padding: 8, borderRadius: 6, background: "rgba(0,0,0,0.2)" }}>
              ✓ Notifications enabled!
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            {!iosNeedsInstall && (
              <button
                onClick={handleEnable}
                disabled={status === "loading"}
                style={primaryBtn}
              >
                {status === "loading" ? "Enabling…" : "🔔 Enable"}
              </button>
            )}
            <button onClick={handleDismiss} style={secondaryBtn}>
              {iosNeedsInstall ? "Got it" : "Not now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Full settings panel for managing push notifications.
 * Drop into a Settings page.
 */
export function NotificationSettings({ token }) {
  const [perm, setPerm] = useState(getPermission());
  const [subscribed, setSubscribed] = useState(false);
  const [prefs, setPrefs] = useState(null);
  const [devices, setDevices] = useState([]);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function refresh() {
    try {
      const [active, p, d] = await Promise.all([
        hasActiveSubscription(),
        getNotificationPreferences(token).catch(() => null),
        listDevices(token).catch(() => [])
      ]);
      setSubscribed(active);
      if (p) setPrefs(p);
      setDevices(d);
      setPerm(getPermission());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { if (token) refresh(); }, [token]);

  async function enable() {
    setBusy("enable");
    setError(null);
    try {
      const res = await subscribeToPush(token);
      if (!res.ok) {
        if (res.reason === "ios_needs_install") {
          setError("On iPhone/iPad, install the app first: Share → Add to Home Screen, then open the installed app and try again.");
        } else if (res.reason === "denied") {
          setError("Notifications are blocked by your browser. Open browser settings → Notifications → Allow for this site.");
        } else {
          setError(res.reason || "Failed to enable.");
        }
      } else {
        setSuccess("Notifications enabled!");
        setTimeout(() => setSuccess(null), 3000);
      }
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function disable() {
    setBusy("disable");
    try {
      await unsubscribeFromPush(token);
      setSuccess("Notifications disabled on this device.");
      setTimeout(() => setSuccess(null), 3000);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setError(null);
    try {
      const result = await sendTestPush(token);
      if (result.sent === 0) {
        setError(`No notification delivered (${result.skipped || "no devices"}). Make sure you've enabled notifications above.`);
      } else {
        setSuccess(`✓ Test notification sent to ${result.sent} device${result.sent > 1 ? "s" : ""}!`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function motivate() {
    setBusy("motivate");
    setError(null);
    try {
      const result = await sendMotivationNow(token);
      if (result.sent === 0) {
        setError(`No motivation delivered (${result.skipped || "no devices"}).`);
      } else {
        setSuccess("✨ Motivation sent! Check your notifications.");
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  async function togglePref(key) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    try {
      await saveNotificationPreferences(token, { [key]: next[key] });
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeOne(id) {
    if (!confirm("Sign out this device from notifications?")) return;
    setBusy("remove-" + id);
    try {
      await removeDevice(token, id);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  if (!isPushSupported()) {
    return (
      <div className="card" style={{ padding: 16 }}>
        <h3 style={{ margin: 0 }}>🔔 Notifications</h3>
        <p className="muted" style={{ marginTop: 8 }}>
          Your browser doesn't support push notifications. Try Chrome, Edge, Firefox, or Safari on an installed PWA.
        </p>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
        🔔 Push Notifications
        <span style={{
          padding: "2px 10px",
          borderRadius: 99,
          fontSize: 11,
          background: subscribed ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.15)",
          color: subscribed ? "#10b981" : "#f87171",
          border: `1px solid ${subscribed ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.3)"}`
        }}>
          {subscribed ? "Active on this device" : "Off"}
        </span>
      </h3>
      <p className="muted" style={{ marginTop: 6, fontSize: 13 }}>
        Get instant alerts for announcements, live classes, assignments, and messages — even when the app is closed.
      </p>

      {isIOS() && !isStandalone() && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: "#fbbf24", fontSize: 13 }}>
          📱 <b>iPhone/iPad users:</b> Install Scholar's Circle first (Share → Add to Home Screen), then open the installed app to enable notifications.
        </div>
      )}

      {error && <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(239,68,68,0.1)", color: "#f87171", fontSize: 13 }}>⚠️ {error}</div>}
      {success && <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: 13 }}>{success}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {!subscribed ? (
          <button onClick={enable} disabled={busy === "enable"} style={primaryBtn}>
            {busy === "enable" ? "Enabling…" : "🔔 Enable notifications"}
          </button>
        ) : (
          <>
            <button onClick={test} disabled={busy === "test"} style={primaryBtn}>
              {busy === "test" ? "Sending…" : "🧪 Send test"}
            </button>
            <button onClick={motivate} disabled={busy === "motivate"} style={primaryBtn}>
              {busy === "motivate" ? "Sending…" : "✨ Motivate me now"}
            </button>
            <button onClick={disable} disabled={busy === "disable"} style={dangerBtn}>
              {busy === "disable" ? "Disabling…" : "Disable on this device"}
            </button>
          </>
        )}
      </div>

      {subscribed && (
        <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: "rgba(255,215,0,0.08)", border: "1px solid rgba(255,215,0,0.2)", fontSize: 12, color: "#FFD700" }}>
          🌅 You'll receive a <b>daily morning motivation</b> and an <b>evening study reminder</b> automatically. Toggle "Study Reminders" below to opt out.
        </div>
      )}

      {/* Per-category preferences */}
      {prefs && subscribed && (
        <div style={{ marginTop: 18 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#FFD700" }}>What to notify me about</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {CATEGORIES.map((c) => (
              <label key={c.key} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 10,
                borderRadius: 8,
                background: "rgba(10,10,10,0.5)",
                border: "1px solid rgba(255,215,0,0.15)",
                cursor: "pointer"
              }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={!!prefs[c.key]}
                  onChange={() => togglePref(c.key)}
                  style={{ width: 18, height: 18, accentColor: "#FFD700" }}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Devices list */}
      {devices.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#FFD700" }}>Your devices ({devices.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {devices.map((d) => (
              <div key={d.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 10,
                borderRadius: 8,
                background: "rgba(10,10,10,0.5)",
                border: "1px solid rgba(255,215,0,0.15)",
                fontSize: 12
              }}>
                <span style={{ fontSize: 18 }}>{deviceIcon(d.userAgent)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {deviceName(d.userAgent)}
                  </div>
                  <div style={{ color: "#9ca3af", fontSize: 11 }}>
                    Last used: {new Date(d.lastUsed).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => removeOne(d.id)}
                  disabled={busy === "remove-" + d.id}
                  style={{ ...dangerBtn, padding: "4px 10px", fontSize: 11 }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function deviceIcon(ua) {
  if (!ua) return "🖥️";
  if (/iPhone|iPad|iPod/i.test(ua)) return "📱";
  if (/Android/i.test(ua)) return "📱";
  if (/Mac|iPad/i.test(ua)) return "💻";
  if (/Windows/i.test(ua)) return "🖥️";
  return "🌐";
}

function deviceName(ua) {
  if (!ua) return "Unknown device";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android device";
  if (/Macintosh/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux";
  return "Browser";
}

const primaryBtn = {
  padding: "10px 16px",
  borderRadius: 8,
  border: "none",
  background: "linear-gradient(135deg, #FFD700, #DAA520)",
  color: "#fff",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer"
};

const secondaryBtn = {
  padding: "10px 16px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.3)",
  background: "transparent",
  color: "#fff",
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer"
};

const dangerBtn = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid rgba(239,68,68,0.4)",
  background: "transparent",
  color: "#f87171",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer"
};
