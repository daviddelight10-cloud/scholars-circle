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
  { key: "groups", icon: "👥", label: "Group Activity", desc: "Messages, joins, goals and battles in your study clans" },
  { key: "studyReminders", icon: "⏰", label: "Study Reminders", desc: "Smart reminders for your study plan" }
];

const COLLAPSE_KEY = "sc_push_card_collapsed";

/**
 * Persistent "turn on notifications" card, like the native-app prompt.
 * Shows on every app open until the user actually enables push.
 * A chevron collapse hides it only for the current session.
 */
export function PushPermissionBanner({ token }) {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | loading | ok | error
  const [error, setError] = useState(null);
  const [perm, setPerm] = useState(() => getPermission());

  const iosNeedsInstall = isIOS() && !isStandalone();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!(await isPushSupported())) return;
      // Session-only collapse — card returns on the next app open.
      if (sessionStorage.getItem(COLLAPSE_KEY) === "1") return;
      const p = getPermission();
      if (cancelled) return;
      setPerm(p);
      if (p === "granted") {
        const active = await hasActiveSubscription();
        if (!cancelled && !active) setVisible(true);
        return;
      }
      // default or denied — keep asking every open
      if (!cancelled) setVisible(true);
    }, 1800);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // Re-check permission when the tab regains focus — a user who re-enabled
  // notifications in browser settings gets the card cleared automatically.
  useEffect(() => {
    if (!visible || perm !== "denied") return;
    async function recheck() {
      if (document.visibilityState !== "visible") return;
      const p = getPermission();
      setPerm(p);
      if (p === "granted") await handleEnable();
      else if (p === "default") setVisible(true);
    }
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
    };
  }, [visible, perm, token]);

  if (!visible) return null;

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
        setError("On iPhone/iPad, install Scholar's Circle first (Share → Add to Home Screen), then open the installed app to enable notifications.");
      } else if (res.reason === "denied") {
        setPerm("denied");
        setStatus("idle");
      } else {
        setStatus("error");
        setError(res.reason === "unsupported" ? "This browser doesn't support push notifications." : "Couldn't enable notifications — please try again.");
      }
    } catch (e) {
      setStatus("error");
      setError("Couldn't enable notifications — please try again.");
    }
  }

  function handleCollapse() {
    sessionStorage.setItem(COLLAPSE_KEY, "1");
    setVisible(false);
  }

  const blocked = perm === "denied" && !iosNeedsInstall;
  const enabled = status === "ok";

  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 76px)",
        left: 12,
        right: 12,
        maxWidth: 480,
        margin: "0 auto",
        zIndex: 1100,
        padding: "13px 14px",
        borderRadius: 18,
        background: "var(--app-card)",
        border: "1px solid var(--app-tint-med)",
        boxShadow: "0 12px 36px rgba(0,0,0,0.35), 0 1px 3px rgba(0,0,0,0.2)",
        fontFamily: "'Manrope', sans-serif",
        color: "var(--app-text)",
        animation: "scPushCardIn 0.35s cubic-bezier(0.21,1.02,0.73,1)",
      }}
    >
      <style>{`@keyframes scPushCardIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{ width: 36, height: 36, borderRadius: 11, background: "rgba(79,142,247,0.12)", border: "1px solid rgba(79,142,247,0.22)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 012 4.5V15l1.5 2.5h-15L8 15v-2.5A6 6 0 0118 8z" stroke="#4F8EF7" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="#4F8EF7" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, fontFamily: "'Syne', sans-serif", color: "var(--app-text)" }}>
            {enabled ? "Notifications on" : blocked ? "Notifications are blocked" : "Turn on notifications"}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--app-dim)", marginTop: 2 }}>
            {enabled
              ? "You're all set — alerts will reach this device."
              : blocked
                ? "Tap the lock icon in the address bar → Site settings → Notifications → Allow, then come back."
                : iosNeedsInstall
                  ? "Install the app first: Share → Add to Home Screen, then enable notifications here."
                  : "Class alerts, messages & study reminders — straight to your device."}
          </div>
        </div>

        {!iosNeedsInstall && !blocked && (
          <button
            role="switch"
            aria-checked={enabled}
            aria-label="Enable notifications"
            disabled={status === "loading" || enabled}
            onClick={handleEnable}
            style={{
              flexShrink: 0,
              width: 46,
              height: 26,
              borderRadius: 999,
              border: "none",
              cursor: status === "loading" ? "wait" : enabled ? "default" : "pointer",
              background: enabled
                ? "linear-gradient(135deg, #34d399, #10b981)"
                : status === "loading"
                  ? "var(--app-tint-strong)"
                  : "var(--app-tint-med)",
              position: "relative",
              transition: "background 0.2s ease",
              padding: 0,
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: enabled || status === "loading" ? 23 : 3,
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                transition: "left 0.18s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
              }}
            >
              {status === "loading" && (
                <span style={{ width: 12, height: 12, border: "2px solid #c8c8c8", borderTopColor: "#666", borderRadius: "50%", animation: "scPushSpin 0.7s linear infinite", display: "block" }} />
              )}
            </span>
            <style>{`@keyframes scPushSpin { to { transform: rotate(360deg); } }`}</style>
          </button>
        )}

        {blocked && (
          <button
            onClick={() => { setPerm(getPermission()); if (getPermission() === "granted") handleEnable(); }}
            style={{ ...secondaryBtn, padding: "8px 12px", fontSize: 12, flexShrink: 0 }}
          >
            Check again
          </button>
        )}

        {iosNeedsInstall && (
          <button onClick={handleCollapse} style={{ ...secondaryBtn, padding: "8px 12px", fontSize: 12, flexShrink: 0 }}>
            Got it
          </button>
        )}

        {!iosNeedsInstall && !blocked && !enabled && (
          <button
            onClick={handleCollapse}
            aria-label="Hide until next session"
            style={{
              flexShrink: 0, width: 28, height: 28, borderRadius: 8,
              background: "none", border: "none", cursor: "pointer",
              color: "var(--app-faint)", fontSize: 14, lineHeight: 1,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            ⌄
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 9, fontSize: 12, padding: 9, borderRadius: 11, background: "rgba(255,84,112,0.08)", border: "1px solid rgba(255,84,112,0.22)", color: "var(--app-red)" }}>
          {error}
        </div>
      )}
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
      <div style={{ background: "var(--app-tint-soft)", border: "1px solid var(--app-tint-med)", borderRadius: 20, padding: 18, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 012 4.5V15l1.5 2.5h-15L8 15v-2.5A6 6 0 0118 8z" stroke="#4F8EF7" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="#4F8EF7" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </div>
          <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "var(--app-text)" }}>Notifications</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--app-dim)", marginTop: 0, fontFamily: "'Manrope', sans-serif" }}>
          Your browser doesn't support push notifications. Try Chrome, Edge, Firefox, or Safari on an installed PWA.
        </p>
      </div>
    );
  }

  return (
    <div style={{ background: "var(--app-tint-soft)", border: "1px solid var(--app-tint-med)", borderRadius: 20, padding: 18, backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(79,142,247,0.1)", border: "1px solid rgba(79,142,247,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 8a6 6 0 012 4.5V15l1.5 2.5h-15L8 15v-2.5A6 6 0 0118 8z" stroke="#4F8EF7" strokeWidth="1.6" strokeLinejoin="round"/><path d="M10 19a2 2 0 004 0" stroke="#4F8EF7" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: "var(--app-text)" }}>Push Notifications</span>
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
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--app-dim)", fontFamily: "'Manrope', sans-serif" }}>
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
          <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--app-text)", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>What to notify me about</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {CATEGORIES.map((c) => (
              <label key={c.key} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                background: "var(--app-tint-soft)",
                border: "1px solid var(--app-tint-soft)",
                cursor: "pointer"
              }}>
                <span style={{ fontSize: 20 }}>{c.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, fontFamily: "'Manrope', sans-serif", color: "var(--app-text)" }}>{c.label}</div>
                  <div style={{ fontSize: 11, color: "var(--app-dim)", fontFamily: "'Manrope', sans-serif" }}>{c.desc}</div>
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
          <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "var(--app-text)", fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Your devices ({devices.length})</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {devices.map((d) => (
              <div key={d.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 12,
                borderRadius: 12,
                background: "var(--app-tint-soft)",
                border: "1px solid var(--app-tint-soft)",
                fontSize: 12
              }}>
                <span style={{ fontSize: 18 }}>{deviceIcon(d.userAgent)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Manrope', sans-serif", color: "var(--app-text)" }}>
                    {deviceName(d.userAgent)}
                  </div>
                  <div style={{ color: "var(--app-dim)", fontSize: 11, fontFamily: "'Manrope', sans-serif" }}>
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
  color: "var(--app-text)",
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
  border: "1px solid var(--app-tint-med)",
  background: "var(--app-tint-soft)",
  color: "var(--app-text)",
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
