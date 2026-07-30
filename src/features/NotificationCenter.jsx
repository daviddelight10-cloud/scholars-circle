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
      if (!(await isPushSupported())) return;
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
      borderRadius: 20,
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(18px)",
      WebkitBackdropFilter: "blur(18px)",
      boxShadow: "0 14px 40px rgba(0,0,0,0.4)",
      fontSize: 14,
      lineHeight: 1.4,
      fontFamily: "'Manrope', sans-serif",
      color: "#EDEFF5"
    }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 012 4.5V15l1.5 2.5h-15L8 15v-2.5A6 6 0 0118 8z" stroke="#4F8EF7" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="#4F8EF7" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, fontFamily: "'Syne', sans-serif", color: "#EDEFF5" }}>Stay in the loop</div>
          <div style={{ fontSize: 12, color: "#9AA3B5", marginTop: 4 }}>
            {iosNeedsInstall
              ? "On iPhone/iPad: tap Share → \"Add to Home Screen\". Open the installed app to turn on alerts for announcements, live classes & messages."
              : "Enable push notifications for announcements, live class alerts, assignments, and direct messages."}
          </div>

          {error && (
            <div style={{ marginTop: 8, fontSize: 12, padding: 10, borderRadius: 12, background: "rgba(255,84,112,0.08)", border: "1px solid rgba(255,84,112,0.2)", color: "#FF5470" }}>
              {error}
            </div>
          )}
          {status === "ok" && (
            <div style={{ marginTop: 8, fontSize: 12, padding: 10, borderRadius: 12, background: "rgba(61,214,140,0.08)", border: "1px solid rgba(61,214,140,0.2)", color: "#3DD68C" }}>
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
                {status === "loading" ? "Enabling…" : "Enable"}
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
  const [pushSupported, setPushSupported] = useState(false);

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

  useEffect(() => {
    (async () => {
      const supported = await isPushSupported();
      setPushSupported(supported);
      if (supported && token) await refresh();
    })();
  }, [token]);

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

  if (!pushSupported) {
    return (
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 012 4.5V15l1.5 2.5h-15L8 15v-2.5A6 6 0 0118 8z" stroke="#4F8EF7" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="#4F8EF7" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#EDEFF5" }}>Notifications</span>
        </div>
        <p style={{ fontSize: 13, color: "#9AA3B5", marginTop: 0, fontFamily: "'Manrope', sans-serif" }}>
          Your browser doesn't support push notifications. Try Chrome, Edge, Firefox, or Safari on an installed PWA.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 20, padding: 18, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 012 4.5V15l1.5 2.5h-15L8 15v-2.5A6 6 0 0118 8z" stroke="#4F8EF7" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="#4F8EF7" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "#EDEFF5" }}>Push Notifications</span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 12px", borderRadius: 99, fontSize: 11, fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
          background: subscribed ? "rgba(61,214,140,0.12)" : "rgba(255,84,112,0.12)",
          color: subscribed ? "#3DD68C" : "#FF5470",
          border: `1px solid ${subscribed ? "rgba(61,214,140,0.3)" : "rgba(255,84,112,0.3)"}`
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: subscribed ? "#3DD68C" : "#FF5470" }} />
          {subscribed ? "Active" : "Off"}
        </span>
      </div>
      <p style={{ marginTop: 0, fontSize: 13, color: "#9AA3B5", fontFamily: "'Manrope', sans-serif" }}>
        Get instant alerts for announcements, live classes, assignments, and messages — even when the app is closed.
      </p>

      {isIOS() && !isStandalone() && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(245,166,35,0.08)", border: "1px solid rgba(245,166,35,0.2)", color: "#F5A623", fontSize: 13, fontFamily: "'Manrope', sans-serif" }}>
          <b>iPhone/iPad users:</b> Install Scholar's Circle first (Share → Add to Home Screen), then open the installed app to enable notifications.
        </div>
      )}

      {error && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,84,112,0.08)", border: "1px solid rgba(255,84,112,0.2)", color: "#FF5470", fontSize: 13, fontFamily: "'Manrope', sans-serif" }}>{error}</div>}
      {success && <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(61,214,140,0.08)", border: "1px solid rgba(61,214,140,0.2)", color: "#3DD68C", fontSize: 13, fontFamily: "'Manrope', sans-serif" }}>{success}</div>}

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {!subscribed ? (
          <button onClick={enable} disabled={busy === "enable"} style={primaryBtn}>
            {busy === "enable" ? "Enabling…" : "Enable notifications"}
          </button>
        ) : (
          <>
            <button onClick={test} disabled={busy === "test"} style={primaryBtn}>
              {busy === "test" ? "Sending…" : "Send test"}
            </button>
            <button onClick={motivate} disabled={busy === "motivate"} style={primaryBtn}>
              {busy === "motivate" ? "Sending…" : "Motivate me now"}
            </button>
            <button onClick={disable} disabled={busy === "disable"} style={dangerBtn}>
              {busy === "disable" ? "Disabling…" : "Disable on this device"}
            </button>
          </>
        )}
      </div>

      {subscribed && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "rgba(245,166,35,0.06)", border: "1px solid rgba(245,166,35,0.15)", fontSize: 12, color: "#F5A623", fontFamily: "'Manrope', sans-serif" }}>
          You'll receive a <b>daily morning motivation</b> and an <b>evening study reminder</b> automatically. Toggle "Study Reminders" below to opt out.
        </div>
      )}

      {/* Per-category preferences */}
      {prefs && subscribed && (
        <div style={{ marginTop: 18 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#EDEFF5", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>What to notify me about</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {CATEGORIES.map((c) => (
              <label key={c.key} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer"
              }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, fontFamily: "'Manrope', sans-serif", color: "#EDEFF5" }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: "#9AA3B5", fontFamily: "'Manrope', sans-serif" }}>{c.desc}</div>
                </div>
                <input
                  type="checkbox"
                  checked={!!prefs[c.key]}
                  onChange={() => togglePref(c.key)}
                  style={{ width: 18, height: 18, accentColor: "#F5A623" }}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Devices list */}
      {devices.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#EDEFF5", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Your devices ({devices.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {devices.map((d) => (
              <div key={d.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                fontSize: 12
              }}>
                <span style={{ fontSize: 18 }}>{deviceIcon(d.userAgent)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Manrope', sans-serif", color: "#EDEFF5" }}>
                    {deviceName(d.userAgent)}
                  </div>
                  <div style={{ color: "#9AA3B5", fontSize: 11, fontFamily: "'Manrope', sans-serif" }}>
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
  borderRadius: 12,
  border: "none",
  background: "linear-gradient(135deg, #F5A623, #D4881A)",
  color: "#fff",
  fontWeight: 700,
  fontSize: 13,
  fontFamily: "'Manrope', sans-serif",
  cursor: "pointer",
  boxShadow: "0 6px 20px -4px rgba(245,166,35,0.4)",
  transition: "transform 0.15s ease"
};

const secondaryBtn = {
  padding: "10px 16px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
  color: "#EDEFF5",
  fontWeight: 600,
  fontSize: 13,
  fontFamily: "'Manrope', sans-serif",
  cursor: "pointer",
  transition: "transform 0.15s ease"
};

const dangerBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,84,112,0.3)",
  background: "rgba(255,84,112,0.08)",
  color: "#FF5470",
  fontWeight: 700,
  fontSize: 13,
  fontFamily: "'Manrope', sans-serif",
  cursor: "pointer",
  transition: "transform 0.15s ease"
};
