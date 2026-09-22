import { lazy, Suspense, useEffect, useState } from "react";
import "./settings.css";
import { DISCIPLINES } from "../AITutor/disciplines.js";
import { ACADEMIC_LEVELS } from "../StudentProfile.jsx";
import TabSkeleton from "../../components/TabSkeleton.jsx";
import ConfirmModal from "./ConfirmModal.jsx";
import { API_BASE, DEMO_ACHIEVEMENTS } from "../../lib/constants";
import { planLabel } from "../../lib/plans";
import { version } from "../../../package.json";

const NotificationSettings = lazy(() =>
  import("../NotificationCenter.jsx").then((m) => ({ default: m.NotificationSettings }))
);

const WHATSAPP_LINK = "https://wa.link/yj2em4";
const SUPPORT_PHONE = "09028617178";

export default function SettingsPage({
  auth,
  token,
  isActivated,
  isFaculty,
  demoMode,
  demoUsage,
  studentProfile,
  onLogout,
  onReset,
  onNavigate,
  onBack,
  onShowPaymentModal,
}) {
  const [confirm, setConfirm] = useState(null); // "logout" | "reset" | null
  const [notifExpanded, setNotifExpanded] = useState(false);
  const [referral, setReferral] = useState(null);
  const [copied, setCopied] = useState(false);

  const user = auth?.user;
  const disc = DISCIPLINES.find((d) => d.id === studentProfile?.discipline);
  const level = ACADEMIC_LEVELS.find((l) => l.id === studentProfile?.level);

  const displayName = studentProfile?.fullName || user?.username || "Your Profile";
  const subText = disc
    ? `${disc.icon} ${disc.label}${level ? ` · ${level.label}` : ""}`
    : level
    ? level.label
    : "Tap to set up your profile";

  // "Complete your profile" hint
  const missing = [
    !studentProfile?.bio && "a bio",
    !studentProfile?.matricNumber && "your Student ID",
    !studentProfile?.targetGrade && "a target grade",
  ].filter(Boolean);
  const todoText = missing.length
    ? `💡 Add ${missing[0]} to complete your profile`
    : "✅ Profile complete";

  // Premium status
  const expiry = user?.activationExpiry ? new Date(user.activationExpiry) : null;
  const daysLeft = expiry ? Math.ceil((expiry - Date.now()) / 86400000) : null;

  // Referral stats for the Refer & Earn row value
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE}/referrals/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (!cancelled && data?.code) setReferral(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [token]);

  function copyKey() {
    const key = user?.activationKey || "";
    if (!key) return;
    if (navigator.clipboard) navigator.clipboard.writeText(key).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1900);
  }

  return (
    <div className="st-root">
      <div className="st-fabrow">
        <button className="st-exitfab st-press" onClick={onBack || (() => {})} aria-label="Back">← Back</button>
      </div>

      {/* Profile summary card */}
      <button className="st-pcard st-press" onClick={() => onNavigate("profile")}>
        <div className="st-avatar">{studentProfile?.avatar || "🎓"}</div>
        <div className="st-who">
          <div className="st-name">{displayName}</div>
          <div className="st-sub">{subText}</div>
          <div className="st-todo">{todoText}</div>
        </div>
        <span className="st-chev">›</span>
      </button>

      {/* Premium status card */}
      {!isFaculty && (
        <button className={`st-premcard st-press${isActivated ? " st-active" : ""}`} onClick={() => onNavigate("premium")}>
          {!isActivated && <span className="st-shine" />}
          <span className="st-pcicon">💎</span>
          <span className="st-pcbody">
            <span className="st-pctop">
              <b>ScholarsCircle Premium</b>
              <span className="st-pcbadge">{isActivated ? "ACTIVE ✓" : "GET"}</span>
            </span>
            <span className="st-pcsub">
              {isActivated
                ? "You have full access — thanks for supporting ScholarsCircle 💛"
                : "Unlimited practice, AI Tutor, analytics & more"}
            </span>
            {isActivated && expiry && (
              <span className="st-pcmeta">
                <span className="st-pchip">💎 {planLabel(user?.planType) || "Active Plan"}</span>
                <span className="st-pchip">⏳ {Math.max(0, daysLeft)} days left</span>
                <span className="st-pchip">
                  📅 {expiry.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </span>
            )}
          </span>
          <span className="st-chev">›</span>
        </button>
      )}

      {/* Account */}
      <div className="st-glabel">Account</div>
      <div className="st-group">
        <button className="st-row st-press" onClick={() => onNavigate("refer")}>
          <span className="st-ricon">🎁</span>
          <span className="st-rlabel">
            Refer & Earn
            <span className="st-rdesc">You & your friend both get 3 free days</span>
          </span>
          <span className="st-rvalue st-gold">{referral?.invited ? `${referral.invited} joined` : "+3 days"}</span>
          <span className="st-chev">›</span>
        </button>
        {user?.activationKey && (
          <button className="st-row st-press" onClick={copyKey}>
            <span className="st-ricon">🔑</span>
            <span className="st-rlabel">
              Activation Key
              <span className="st-rdesc">
                {isActivated ? "Your account key" : "Share this key with your teacher to get activated"}
              </span>
            </span>
            <span className="st-rvalue st-gold">{copied ? "Copied ✓" : user.activationKey}</span>
            <span className="st-chev">›</span>
          </button>
        )}
      </div>

      {/* Preferences */}
      <div className="st-glabel">Preferences</div>
      <div className="st-group">
        <div className="st-row" style={{ cursor: "default" }}>
          <span className="st-ricon">🌗</span>
          <span className="st-rlabel">Appearance</span>
          <span className="st-rvalue">Dark</span>
        </div>
        <button className="st-row st-press" onClick={() => setNotifExpanded((v) => !v)}>
          <span className="st-ricon">🔔</span>
          <span className="st-rlabel">
            Push Notifications
            <span className="st-rdesc">Reminders, streak alerts & more</span>
          </span>
          <span className="st-rvalue">
            {typeof Notification !== "undefined" && Notification.permission === "granted" ? "On" : "Off"}
          </span>
          <span className="st-chev">{notifExpanded ? "▾" : "›"}</span>
        </button>
      </div>
      {notifExpanded && (
        <div className="st-notif-panel" style={{ marginTop: 10 }}>
          <Suspense fallback={<TabSkeleton />}>
            <NotificationSettings token={token} />
          </Suspense>
        </div>
      )}

      {/* Support */}
      <div className="st-glabel">Support</div>
      <div className="st-group">
        <a className="st-row st-press" href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
          <span className="st-ricon">💬</span>
          <span className="st-rlabel">
            <span className="st-green">Chat on WhatsApp</span>
            <span className="st-rdesc">9AM–6PM Mon–Fri</span>
          </span>
          <span className="st-chev">›</span>
        </a>
        <a className="st-row st-press" href={`tel:${SUPPORT_PHONE}`} style={{ textDecoration: "none" }}>
          <span className="st-ricon">📞</span>
          <span className="st-rlabel">
            Call support
            <span className="st-rdesc">{SUPPORT_PHONE}</span>
          </span>
          <span className="st-chev">›</span>
        </a>
        <details>
          <summary className="st-row st-press">
            <span className="st-ricon">❓</span>
            <span className="st-rlabel">Common issues</span>
            <span className="st-chev" style={{ color: "var(--st-accent)" }}>▸</span>
          </summary>
          <div className="st-faq"><b>Reset password?</b> — Contact support via WhatsApp with your username and email. We'll help you reset it.</div>
          <div className="st-faq"><b>Not installing on iPhone?</b> — Tap Share → Add to Home Screen. Make sure you're on Safari and HTTPS.</div>
          <div className="st-faq"><b>Activate account?</b> — Share your activation key (Account section above) with your teacher or pay for Premium.</div>
        </details>
      </div>

      {/* Feedback */}
      <div className="st-glabel">Feedback</div>
      <div className="st-group">
        <a
          className="st-row st-press"
          href={`${WHATSAPP_LINK}?text=${encodeURIComponent("Hi Scholar's Circle team, I have a suggestion/feedback:")}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: "none" }}
        >
          <span className="st-ricon">📝</span>
          <span className="st-rlabel">Send feedback</span>
          <span className="st-chev">›</span>
        </a>
      </div>

      {/* Demo progress */}
      {demoMode && demoUsage?.demoProgress && (
        <>
          <div className="st-glabel">Demo Progress</div>
          <div className="st-group" style={{ padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
              {DEMO_ACHIEVEMENTS.map((ach) => {
                const earned = demoUsage.demoProgress.achievements?.includes(ach.id);
                return (
                  <div key={ach.id} style={{
                    background: earned ? "rgba(61,220,132,.08)" : "var(--st-card2)",
                    border: `1px solid ${earned ? "rgba(61,220,132,.25)" : "var(--st-line)"}`,
                    borderRadius: 12, padding: 12, opacity: earned ? 1 : 0.6,
                  }}>
                    <div style={{ fontSize: 18 }}>{ach.icon}</div>
                    <div style={{ fontWeight: 600, fontSize: 12, marginTop: 4 }}>{ach.label}</div>
                    <div style={{ fontSize: 10, marginTop: 2, color: "var(--st-muted)" }}>{ach.desc}</div>
                    {earned && <div style={{ color: "var(--st-green)", fontSize: 10, marginTop: 4, fontWeight: 600 }}>✓ Earned</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 14, padding: 12, background: "rgba(255,214,10,.06)", borderRadius: 12, border: "1px solid rgba(255,214,10,.15)" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 13 }}>
                Completion: {Math.round(((demoUsage.demoProgress.achievements?.length || 0) / DEMO_ACHIEVEMENTS.length) * 100)}%
              </div>
              <div style={{ height: 6, background: "rgba(255,255,255,.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%",
                  width: `${((demoUsage.demoProgress.achievements?.length || 0) / DEMO_ACHIEVEMENTS.length) * 100}%`,
                  background: "linear-gradient(90deg, var(--st-accent2), var(--st-accent))",
                  transition: "width 0.3s",
                }} />
              </div>
              <button onClick={onShowPaymentModal} className="st-save st-press" style={{ marginTop: 10, width: "100%", padding: 12, fontSize: 13 }}>
                ⭐ Upgrade to Full Version
              </button>
            </div>
          </div>
        </>
      )}

      {/* Danger zone */}
      <div className="st-glabel">Danger zone</div>
      <div className="st-group">
        <button className="st-row st-press st-red" onClick={() => setConfirm("logout")}>
          <span className="st-ricon">🚪</span>
          <span className="st-rlabel">Log out</span>
          <span className="st-chev">›</span>
        </button>
        <button className="st-row st-press st-red" onClick={() => setConfirm("reset")}>
          <span className="st-ricon">⚠️</span>
          <span className="st-rlabel">Reset all data</span>
          <span className="st-chev">›</span>
        </button>
      </div>

      <p className="st-ver">ScholarsCircle v{version} · Made for scholars 🎓</p>

      {/* Confirm modal */}
      <ConfirmModal
        open={confirm === "logout" || confirm === "reset"}
        title={confirm === "logout" ? "Log out?" : "Reset all data?"}
        text={
          confirm === "logout"
            ? "You can log back in anytime — your progress is saved."
            : "This permanently deletes your notes, streaks and progress. Cannot be undone."
        }
        confirmLabel={confirm === "logout" ? "Log out" : "Delete everything"}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          const action = confirm;
          setConfirm(null);
          if (action === "logout") onLogout();
          else onReset();
        }}
      />
    </div>
  );
}
