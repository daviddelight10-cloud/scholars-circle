import React, { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "../lib/appUtils";
import { toast } from "../components/Toast";

const D = {
  bg: "#08090f",
  card: "#0e1020",
  faint: "#12142a",
  line: "#1e2140",
  gold: "#DAA520",
  goldBright: "#FFD700",
  text: "#e8eaf6",
  muted: "#8b92c4",
  hint: "#4a5080",
  green: "#34d399",
  red: "#f87171",
  orange: "#fb923c",
  teal: "#5eead4",
  pink: "#f48fb1",
  purple: "#c084fc",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@400;500;600;700&display=swap');
  @keyframes ad-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes ad-drawer { from{transform:translateX(100%)} to{transform:translateX(0)} }
  @keyframes ad-fade { from{opacity:0} to{opacity:1} }
  .ad-wrap { font-family:'Manrope',sans-serif; color:${D.text}; }
  .ad-tabs { display:flex; gap:6px; overflow-x:auto; scrollbar-width:none; padding-bottom:4px; margin-bottom:16px; }
  .ad-tab { background:${D.faint}; border:0.5px solid ${D.line}; color:${D.hint}; border-radius:999px; padding:8px 16px; font-size:12px; font-weight:700; font-family:'Syne',sans-serif; letter-spacing:0.04em; cursor:pointer; white-space:nowrap; transition:all 0.15s; }
  .ad-tab:hover { color:${D.muted}; }
  .ad-tab.on { background:rgba(218,165,32,0.14); border-color:${D.gold}; color:${D.goldBright}; }
  .ad-tab .badge { display:inline-block; margin-left:6px; background:${D.red}; color:#fff; border-radius:999px; font-size:9px; padding:1px 6px; font-family:'Manrope',sans-serif; }
  .ad-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
  .ad-kpi { background:${D.card}; border:0.5px solid ${D.line}; border-radius:16px; padding:14px; cursor:default; transition:border-color 0.2s; }
  .ad-kpi:hover { border-color:${D.hint}; }
  .ad-kpi.link { cursor:pointer; }
  .ad-kpi.link:hover { border-color:${D.gold}; }
  .ad-card { background:${D.card}; border:0.5px solid ${D.line}; border-radius:16px; padding:16px; margin-bottom:14px; }
  .ad-title { font-size:11px; font-weight:700; color:${D.gold}; letter-spacing:0.08em; text-transform:uppercase; font-family:'Syne',sans-serif; margin-bottom:12px; }
  .ad-row { animation:ad-in 0.25s ease forwards; transition:background 0.15s; }
  .ad-row:hover { background:#161936 !important; }
  .ad-row.clickable { cursor:pointer; }
  .ad-pill { display:inline-flex; align-items:center; gap:4px; font-size:9.5px; font-weight:700; border-radius:6px; padding:2.5px 8px; letter-spacing:0.04em; text-transform:uppercase; font-family:'Manrope',sans-serif; }
  .ad-btn { border:none; border-radius:9px; padding:8px 16px; font-size:11.5px; font-weight:700; font-family:'Syne',sans-serif; letter-spacing:0.04em; cursor:pointer; transition:all 0.15s; }
  .ad-btn:disabled { opacity:0.45; cursor:default; }
  .ad-btn.gold { background:linear-gradient(135deg,#DAA520,#b8860b); color:#fff; }
  .ad-btn.ghost { background:${D.faint}; border:0.5px solid ${D.line}; color:${D.muted}; }
  .ad-btn.ghost:hover { color:${D.text}; border-color:${D.hint}; }
  .ad-btn.green { background:rgba(52,211,153,0.15); border:0.5px solid rgba(52,211,153,0.4); color:${D.green}; }
  .ad-btn.red { background:rgba(248,113,113,0.12); border:0.5px solid rgba(248,113,113,0.35); color:${D.red}; }
  .ad-input { background:${D.faint}; border:0.5px solid ${D.line}; border-radius:9px; padding:8px 12px; font-size:12px; color:${D.text}; font-family:'Manrope',sans-serif; outline:none; }
  .ad-input:focus { border-color:${D.gold}; }
  .ad-fp { background:transparent; border:0.5px solid ${D.line}; color:${D.hint}; border-radius:999px; padding:5px 13px; font-size:11px; font-weight:700; font-family:'Manrope',sans-serif; cursor:pointer; transition:all 0.15s; }
  .ad-fp.on { background:rgba(218,165,32,0.12); border-color:${D.gold}; color:${D.goldBright}; }
  .ad-drawer-bg { position:fixed; inset:0; background:rgba(5,6,12,0.7); z-index:200; animation:ad-fade 0.2s ease; }
  .ad-drawer { position:fixed; top:0; right:0; bottom:0; width:min(420px,100vw); background:${D.card}; border-left:0.5px solid ${D.line}; z-index:201; overflow-y:auto; animation:ad-drawer 0.25s ease; padding:20px; }
  .ad-modal-bg { position:fixed; inset:0; background:rgba(5,6,12,0.8); display:flex; align-items:center; justify-content:center; z-index:300; padding:20px; animation:ad-fade 0.15s ease; }
  .ad-modal { background:${D.card}; border:0.5px solid ${D.line}; border-radius:18px; padding:22px; width:100%; max-width:400px; }
  .ad-two { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media (max-width:760px) {
    .ad-kpis { grid-template-columns:repeat(2,1fr); }
    .ad-two { grid-template-columns:1fr; }
  }
  @media (max-width:480px) {
    .ad-kpis { grid-template-columns:repeat(2,1fr); }
  }
`;

const ROLE_COLORS = { STUDENT: D.teal, TEACHER: D.orange, LECTURER: D.pink };
const EVENT_LABELS = {
  admin_role_change: "🔄 Role changed",
  admin_user_deleted: "🗑 User deleted",
  admin_folder_deleted: "📁 Folder deleted",
  admin_broadcast: "📣 Push broadcast",
  admin_payment_approved: "✅ Payment approved",
  admin_payment_rejected: "❌ Payment rejected",
  account_deleted: "👤 Account deleted",
};

function deviceOf(ua) {
  if (!ua) return "Unknown device";
  const os = /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "Mac" : /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Linux/i.test(ua) ? "Linux" : "Other";
  const br = /Edg/i.test(ua) ? "Edge" : /Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : "Browser";
  return `${br} · ${os}`;
}
const REPORT_REASONS = { outdated: "🕐 Outdated", errors: "❌ Errors", course: "📚 Wrong course", spam: "🚫 Spam" };
const PLAN_LABELS = { week1: "1 Week", week2: "2 Weeks", month1: "1 Month", semester: "Semester" };

function timeAgo(ts) {
  if (!ts) return "—";
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Kpi({ icon, label, value, sub, color = D.goldBright, onClick }) {
  return (
    <div className={`ad-kpi${onClick ? " link" : ""}`} onClick={onClick}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
        <span style={{ fontSize: 9.5, color: D.hint, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 800, color, fontFamily: "Syne,sans-serif", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: D.hint, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function DualChart({ days, a, b, labelA, labelB }) {
  const max = Math.max(...a, ...b, 1);
  return (
    <div>
      <div style={{ display: "flex", gap: 14, marginBottom: 12, fontSize: 10, color: D.muted }}>
        <span><span style={{ color: D.goldBright }}>■</span> {labelA}</span>
        <span><span style={{ color: "#5c6bc0" }}>■</span> {labelB}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 90 }}>
        {days.map((day, i) => {
          const d = new Date(day);
          const isToday = day === new Date().toDateString();
          return (
            <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }} title={`${d.getMonth() + 1}/${d.getDate()} — ${labelA}: ${a[i]}, ${labelB}: ${b[i]}`}>
              <div style={{ display: "flex", gap: 2, alignItems: "flex-end", width: "100%", justifyContent: "center", height: 64 }}>
                <div style={{ width: "42%", height: `${Math.max(4, (a[i] / max) * 64)}px`, background: "linear-gradient(180deg,#DAA520,#8a6d0b)", borderRadius: 3 }} />
                <div style={{ width: "42%", height: `${Math.max(4, (b[i] / max) * 64)}px`, background: isToday ? "#7c8ae0" : "#3a3f7a", borderRadius: 3 }} />
              </div>
              {i % 2 === 0 && <div style={{ fontSize: 8, color: isToday ? D.gold : D.hint }}>{d.getMonth() + 1}/{d.getDate()}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HBar({ items, color = D.gold }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((it) => (
        <div key={it.endpoint || it.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
            <span style={{ color: D.muted, fontFamily: "monospace" }}>{it.endpoint || it.label}</span>
            <span style={{ color: D.text, fontWeight: 700 }}>{it.count}</span>
          </div>
          <div style={{ height: 6, background: D.faint, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(it.count / max) * 100}%`, height: "100%", background: `linear-gradient(90deg,${color},${color}99)`, borderRadius: 3 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Pill({ color, children }) {
  return (
    <span className="ad-pill" style={{ color, background: `${color}18`, border: `0.5px solid ${color}40` }}>{children}</span>
  );
}

function Empty({ text }) {
  return <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12, color: D.hint }}>{text}</div>;
}

function Spinner({ text = "Loading…" }) {
  return <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12, color: D.hint }}>⏳ {text}</div>;
}

function ConfirmModal({ title, body, confirmLabel = "Confirm", danger, onConfirm, onClose, busy }) {
  return (
    <div className="ad-modal-bg" onClick={onClose}>
      <div className="ad-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "Syne,sans-serif", color: danger ? D.red : D.text, marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: D.muted, lineHeight: 1.6, marginBottom: 18 }}>{body}</div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="ad-btn ghost" onClick={onClose}>Cancel</button>
          <button className={`ad-btn ${danger ? "red" : "gold"}`} onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── User detail drawer ────────────────────────────────────────────────────────
function UserDrawer({ userId, token, onClose, onChanged }) {
  const [u, setU] = useState(null);
  const [busy, setBusy] = useState("");
  const [duration, setDuration] = useState("month1");
  const [roleSel, setRoleSel] = useState("");
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    try { setU(await api(`/admin/users/${userId}`, { token })); }
    catch (e) { toast.error(e.message); onClose(); }
  }, [userId, token, onClose]);

  useEffect(() => { load(); }, [load]);

  async function act(key, fn) {
    setBusy(key);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) { toast.error(e.message); }
    setBusy("");
  }

  if (!u) {
    return (
      <>
        <div className="ad-drawer-bg" onClick={onClose} />
        <div className="ad-drawer"><Spinner text="Loading user…" /></div>
      </>
    );
  }

  const expired = u.activationExpiry && new Date(u.activationExpiry) <= new Date();
  const isStudent = u.role === "STUDENT";
  const xp = u.progress?.xp ?? 0;
  const streak = u.progress?.streak ?? u.progress?.currentStreak ?? null;

  const fields = [
    ["Email", u.email],
    ["Joined", u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"],
    ["Last login", u.lastLoginAt ? `${timeAgo(u.lastLoginAt)}` : "never"],
    ["Plan", u.planType ? PLAN_LABELS[u.planType] || u.planType : "—"],
    ["Subscription", u.isActivated ? (expired ? "Expired" : `Active → ${new Date(u.activationExpiry).toLocaleDateString()}`) : "Not activated"],
    ["Payment", `${u.paymentStatus}${u.transactionId ? ` · ${u.transactionId}` : ""}`],
    ["Activated by", u.activatedByUsername || "—"],
    ["Referral code", u.referralCode || "—"],
    ["Referred by", u.referredBy?.username || "—"],
    ["Referrals made", u._count?.referralsGiven ?? 0],
    ["Banked days", u.referralBankedDays ?? 0],
    ["XP", xp],
    ...(streak != null ? [["Streak", `${streak}d`]] : []),
    ["AI calls (30d)", u.aiCalls30d],
    ["Uploads", u.uploads],
    ["Classrooms", u._count?.classroomMembers ?? 0],
    ["Total logins", u._count?.loginEvents ?? 0],
    ["Flashcards", u._count?.flashcards ?? 0],
  ];

  return (
    <>
      <div className="ad-drawer-bg" onClick={onClose} />
      <div className="ad-drawer">
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg,${ROLE_COLORS[u.role] || D.gold}33,${ROLE_COLORS[u.role] || D.gold}11)`,
            border: `1px solid ${ROLE_COLORS[u.role] || D.gold}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, fontWeight: 800, color: ROLE_COLORS[u.role] || D.gold, fontFamily: "Syne,sans-serif",
          }}>
            {(u.username || u.email || "?").slice(0, 1).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "Syne,sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username || u.fullName || "—"}</div>
            <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
              <Pill color={ROLE_COLORS[u.role] || D.muted}>{u.role}</Pill>
              {u.isActivated && !expired && <Pill color={D.green}>active</Pill>}
              {expired && <Pill color={D.red}>expired</Pill>}
              {u.paymentStatus === "pending" && u.transactionId && <Pill color={D.orange}>payment pending</Pill>}
            </div>
          </div>
          <button className="ad-btn ghost" onClick={onClose} style={{ padding: "6px 10px" }}>✕</button>
        </div>

        {/* Fields */}
        <div className="ad-card" style={{ padding: 0, overflow: "hidden" }}>
          {fields.map(([k, v], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 14px", fontSize: 12, borderBottom: i < fields.length - 1 ? `0.5px solid ${D.line}` : "none" }}>
              <span style={{ color: D.hint }}>{k}</span>
              <span style={{ color: D.text, fontWeight: 600, textAlign: "right", wordBreak: "break-word" }}>{String(v ?? "—")}</span>
            </div>
          ))}
        </div>

        {/* Subscription actions */}
        {isStudent && (
          <div className="ad-card">
            <div className="ad-title">Subscription</div>
            {u.isActivated && !expired ? (
              <button className="ad-btn red" disabled={busy === "deact"} onClick={() =>
                act("deact", () => api(`/keys/deactivate/${u.id}`, { token, method: "POST" }))
              }>
                {busy === "deact" ? "…" : "Deactivate access"}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="ad-input" value={duration} onChange={(e) => setDuration(e.target.value)} style={{ flex: 1 }}>
                  <option value="week1">1 Week — ₦700</option>
                  <option value="week2">2 Weeks — ₦1,300</option>
                  <option value="month1">1 Month — ₦2,400</option>
                </select>
                <button className="ad-btn green" disabled={busy === "act"} onClick={() =>
                  act("act", () => api(`/keys/activate/${u.id}`, { token, method: "POST", body: { duration } }))
                }>
                  {busy === "act" ? "…" : "Activate"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Recent logins */}
        <div className="ad-card">
          <div className="ad-title">Recent logins</div>
          {!u.recentLogins?.length ? (
            <div style={{ fontSize: 11.5, color: D.hint }}>No login events recorded yet.</div>
          ) : (
            u.recentLogins.map((l, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 11.5, borderBottom: i < u.recentLogins.length - 1 ? `0.5px solid ${D.line}` : "none" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{deviceOf(l.userAgent)}</div>
                  <div style={{ fontSize: 10, color: D.hint, fontFamily: "monospace" }}>{l.ip || "no ip"}</div>
                </div>
                <span style={{ fontSize: 10, color: D.muted }}>{timeAgo(l.createdAt)}</span>
              </div>
            ))
          )}
        </div>

        {/* Role */}
        <div className="ad-card">
          <div className="ad-title">Role</div>
          <div style={{ display: "flex", gap: 8 }}>
            <select className="ad-input" value={roleSel || u.role} onChange={(e) => setRoleSel(e.target.value)} style={{ flex: 1 }}>
              <option value="STUDENT">Student</option>
              <option value="LECTURER">Lecturer</option>
              <option value="TEACHER">Teacher (admin)</option>
            </select>
            <button
              className="ad-btn gold"
              disabled={!roleSel || roleSel === u.role || busy === "role"}
              onClick={() => setConfirm({
                title: `Make ${u.username || u.email} a ${roleSel?.toLowerCase()}?`,
                body: roleSel === "TEACHER" ? "They will gain full admin access — user management, reports, broadcasts, everything in this panel." : `They will lose faculty access and become a ${roleSel?.toLowerCase()}.`,
                confirmLabel: "Change role",
                run: () => act("role", () => api(`/admin/users/${u.id}/role`, { token, method: "PATCH", body: { role: roleSel } })),
              })}
            >
              {busy === "role" ? "…" : "Apply"}
            </button>
          </div>
        </div>

        {/* Danger zone */}
        {u.role !== "TEACHER" && (
          <div className="ad-card" style={{ borderColor: "rgba(248,113,113,0.3)" }}>
            <div className="ad-title" style={{ color: D.red }}>Danger zone</div>
            <button className="ad-btn red" onClick={() => setConfirm({
              title: `Delete ${u.username || u.email}?`,
              body: "Permanently deletes the account and all their data — progress, uploads, reviews, everything. This cannot be undone.",
              confirmLabel: "Delete permanently",
              danger: true,
              run: async () => {
                await act("del", () => api(`/admin/users/${u.id}`, { token, method: "DELETE" }));
                onClose();
              },
            })}>
              🗑 Delete account
            </button>
          </div>
        )}

        {confirm && (
          <ConfirmModal
            title={confirm.title}
            body={confirm.body}
            confirmLabel={confirm.confirmLabel}
            danger={confirm.danger}
            busy={!!busy}
            onClose={() => setConfirm(null)}
            onConfirm={async () => { setConfirm(null); await confirm.run(); }}
          />
        )}
      </div>
    </>
  );
}

// ─── Main AdminDashboard ───────────────────────────────────────────────────────
export default function AdminDashboard({ token }) {
  const [sub, setSub] = useState("overview");
  const [loaded, setLoaded] = useState({});
  const [busy, setBusy] = useState(false);

  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState(null);
  const [content, setContent] = useState(null);
  const [users, setUsers] = useState([]);
  const [logins, setLogins] = useState([]);
  const [reports, setReports] = useState(null);
  const [reportStatus, setReportStatus] = useState("open");
  const [aiUsage, setAiUsage] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [activity, setActivity] = useState(null);
  const [sharedIps, setSharedIps] = useState(null);

  const [drawerUser, setDrawerUser] = useState(null);
  const [userSearch, setUserSearch] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [sortBy, setSortBy] = useState("joined");
  const [sortDir, setSortDir] = useState("desc");
  const [confirm, setConfirm] = useState(null);

  const [bcTitle, setBcTitle] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [bcRole, setBcRole] = useState("");
  const [bcSending, setBcSending] = useState(false);

  const markLoaded = (key) => setLoaded((p) => ({ ...p, [key]: true }));

  const loadOverview = useCallback(async () => {
    setBusy(true);
    try {
      const [s, r, c] = await Promise.all([
        api("/admin/stats", { token }),
        api("/admin/referrals", { token }),
        api("/admin/content", { token }),
      ]);
      setStats(s); setReferrals(r); setContent(c);
      markLoaded("overview");
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  }, [token]);

  const loadUsers = useCallback(async () => {
    setBusy(true);
    try {
      const [u, l] = await Promise.all([api("/users", { token }), api("/users/logins", { token })]);
      setUsers(u); setLogins(l);
      api("/admin/shared-ips", { token }).then(setSharedIps).catch(() => setSharedIps([]));
      markLoaded("users");
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  }, [token]);

  const loadReports = useCallback(async (status = reportStatus) => {
    setBusy(true);
    try {
      setReports(await api(`/admin/reports?status=${status}`, { token }));
      markLoaded("reports");
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  }, [token, reportStatus]);

  const loadAi = useCallback(async () => {
    setBusy(true);
    try { setAiUsage(await api("/admin/ai-usage?days=30", { token })); markLoaded("ai"); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  }, [token]);

  const loadRevenue = useCallback(async () => {
    setBusy(true);
    try { setRevenue(await api("/admin/revenue", { token })); markLoaded("revenue"); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  }, [token]);

  const loadActivity = useCallback(async () => {
    setBusy(true);
    try { setActivity(await api("/admin/activity", { token })); markLoaded("activity"); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  }, [token]);

  // Lazy-load per tab
  useEffect(() => {
    if (!token) return;
    if (sub === "overview" && !loaded.overview) loadOverview();
    if (sub === "users" && !loaded.users) loadUsers();
    if (sub === "reports" && !loaded.reports) loadReports();
    if (sub === "ai" && !loaded.ai) loadAi();
    if (sub === "revenue" && !loaded.revenue) loadRevenue();
    if (sub === "activity" && !loaded.activity) loadActivity();
  }, [sub, token, loaded, loadOverview, loadUsers, loadReports, loadAi, loadRevenue, loadActivity]);

  const refresh = () => {
    if (sub === "overview") loadOverview();
    else if (sub === "users") loadUsers();
    else if (sub === "reports") loadReports();
    else if (sub === "ai") loadAi();
    else if (sub === "revenue") loadRevenue();
    else if (sub === "activity") loadActivity();
  };

  // ── users tab derived data ──
  const now = Date.now();
  const isActiveSub = (u) => u.isActivated && u.activationExpiry && new Date(u.activationExpiry).getTime() > now;
  const isExpired = (u) => u.activationExpiry && new Date(u.activationExpiry).getTime() <= now;

  const loginCountByUser = useMemo(() => {
    const map = {};
    logins.forEach((l) => { const uid = l.user?.id || l.userId; if (uid) map[uid] = (map[uid] || 0) + 1; });
    return map;
  }, [logins]);

  const lastLoginByUser = useMemo(() => {
    const map = {};
    logins.forEach((l) => {
      const uid = l.user?.id || l.userId;
      if (uid && (!map[uid] || new Date(l.createdAt) > new Date(map[uid]))) map[uid] = l.createdAt;
    });
    return map;
  }, [logins]);

  const filteredUsers = useMemo(() => {
    let arr = users.filter((u) => {
      if (userFilter === "students" && u.role !== "STUDENT") return false;
      if (userFilter === "faculty" && u.role === "STUDENT") return false;
      if (userFilter === "premium" && !isActiveSub(u)) return false;
      if (userFilter === "free" && (u.role !== "STUDENT" || isActiveSub(u))) return false;
      if (userFilter === "expired" && !(u.isActivated && isExpired(u))) return false;
      if (userFilter === "pending" && !(u.paymentStatus === "pending" && u.transactionId)) return false;
      if (userSearch) {
        const q = userSearch.toLowerCase();
        return u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
      }
      return true;
    });
    arr = [...arr].sort((a, b) => {
      let va, vb;
      if (sortBy === "joined") { va = new Date(a.createdAt || 0); vb = new Date(b.createdAt || 0); }
      else if (sortBy === "name") { va = a.username || ""; vb = b.username || ""; }
      else if (sortBy === "logins") { va = loginCountByUser[a.id] || 0; vb = loginCountByUser[b.id] || 0; }
      else if (sortBy === "last") { va = new Date(lastLoginByUser[a.id] || 0); vb = new Date(lastLoginByUser[b.id] || 0); }
      else if (sortBy === "expiry") { va = new Date(a.activationExpiry || 0); vb = new Date(b.activationExpiry || 0); }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return arr;
  }, [users, userSearch, userFilter, sortBy, sortDir, loginCountByUser, lastLoginByUser, now]);

  function exportCsv() {
    const rows = [["username", "email", "role", "plan", "active", "expiry", "payment", "logins30d", "joined"]];
    filteredUsers.forEach((u) => rows.push([
      u.username || "", u.email || "", u.role || "", u.planType || "",
      isActiveSub(u) ? "yes" : "no", u.activationExpiry || "", u.paymentStatus || "",
      loginCountByUser[u.id] || 0, u.createdAt || "",
    ]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function sendBroadcast() {
    if (!bcTitle.trim()) return;
    setBcSending(true);
    try {
      const r = await api("/admin/broadcast", { token, method: "POST", body: { title: bcTitle, body: bcBody, targetRole: bcRole || undefined } });
      toast.success(`Broadcast sent to ${r.users} user(s) — ${r.sent} device(s) reached`);
      setBcTitle(""); setBcBody("");
    } catch (e) { toast.error(e.message); }
    setBcSending(false);
  }

  const TABS = [
    ["overview", "📊 Overview"],
    ["users", "👥 Users"],
    ["reports", "🚩 Reports", stats?.openReports],
    ["ai", "🤖 AI Usage"],
    ["revenue", "💰 Revenue"],
    ["activity", "🧾 Activity"],
    ["broadcast", "📣 Broadcast"],
  ];

  return (
    <div className="ad-wrap">
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "Syne,sans-serif" }}>🛡️ Admin Panel</div>
          <div style={{ fontSize: 11, color: D.muted }}>Platform management &amp; oversight</div>
        </div>
        {sub !== "broadcast" && (
          <button className="ad-btn ghost" onClick={refresh} disabled={busy || !token}>
            {busy ? "⏳ Loading…" : "🔄 Refresh"}
          </button>
        )}
      </div>

      {!token && (
        <div style={{ background: "#1a1000", border: "0.5px solid #4a3a00", borderRadius: 12, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#ffb74d" }}>
          ⚠️ Backend token missing — log in via backend to see live data.
        </div>
      )}

      {/* Tabs */}
      <div className="ad-tabs">
        {TABS.map(([key, label, badge]) => (
          <button key={key} className={`ad-tab${sub === key ? " on" : ""}`} onClick={() => setSub(key)}>
            {label}
            {badge > 0 && <span className="badge">{badge}</span>}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {sub === "overview" && (
        <>
          {!stats ? <Spinner /> : (
            <>
              <div className="ad-kpis">
                <Kpi icon="👥" label="Total users" value={stats.totalUsers} />
                <Kpi icon="🎓" label="Students" value={stats.byRole.STUDENT} color={D.teal} />
                <Kpi icon="🧑‍🏫" label="Faculty" value={(stats.byRole.TEACHER || 0) + (stats.byRole.LECTURER || 0)} color={D.orange} />
                <Kpi icon="⭐" label="Active subs" value={stats.activeSubs} color={D.goldBright} onClick={() => setSub("revenue")} />
                <Kpi icon="🟢" label="DAU" value={stats.dau} color={D.green} sub="active today" />
                <Kpi icon="📅" label="WAU" value={stats.wau} color={D.green} sub="last 7 days" />
                <Kpi icon="📆" label="MAU" value={stats.mau} color={D.green} sub="last 30 days" />
                <Kpi icon="🚩" label="Open reports" value={stats.openReports} color={stats.openReports ? D.red : D.hint} onClick={() => setSub("reports")} />
                <Kpi icon="🤖" label="AI calls" value={stats.aiCalls30d} color={D.purple} sub="last 30 days" onClick={() => setSub("ai")} />
                <Kpi icon="📄" label="Resources" value={stats.resourceCount} />
                <Kpi icon="❓" label="Questions" value={stats.questionCount} />
                <Kpi icon="💳" label="Pending pay" value={stats.pendingPayments} color={stats.pendingPayments ? D.orange : D.hint} onClick={() => setSub("revenue")} />
              </div>

              <div className="ad-card">
                <div className="ad-title">Signups vs logins — 14 days</div>
                <DualChart days={stats.days} a={stats.signups14d} b={stats.logins14d} labelA="Signups" labelB="Logins" />
              </div>

              <div className="ad-two">
                <div className="ad-card">
                  <div className="ad-title">🏆 Top referrers</div>
                  {!referrals?.top?.length ? <Empty text="No referrals yet." /> : (
                    referrals.top.slice(0, 6).map((r, i) => (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < Math.min(referrals.top.length, 6) - 1 ? `0.5px solid ${D.line}` : "none", fontSize: 12 }}>
                        <span style={{ width: 18, color: i < 3 ? D.gold : D.hint, fontWeight: 800, fontFamily: "Syne,sans-serif" }}>{i + 1}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.username || r.email}</div>
                          <div style={{ fontSize: 10, color: D.hint }}>{r.referralCode}</div>
                        </div>
                        <Pill color={D.gold}>{r._count.referralsGiven} refs</Pill>
                      </div>
                    ))
                  )}
                </div>
                <div className="ad-card">
                  <div className="ad-title">📄 Recent uploads</div>
                  {!content?.length ? <Empty text="No uploads yet." /> : (
                    content.slice(0, 6).map((r, i) => (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: i < Math.min(content.length, 6) - 1 ? `0.5px solid ${D.line}` : "none", fontSize: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                          <div style={{ fontSize: 10, color: D.hint }}>{r.uploader?.username || "?"} · {timeAgo(r.createdAt)}</div>
                        </div>
                        <Pill color={D.muted}>{r.contentType}</Pill>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── USERS ── */}
      {sub === "users" && (
        <>
          {sharedIps?.length > 0 && (
            <div className="ad-card" style={{ borderColor: "rgba(251,146,60,0.35)" }}>
              <div className="ad-title" style={{ color: D.orange }}>⚠️ Shared IPs — possible account sharing</div>
              {sharedIps.map((s) => (
                <div key={s.ip} style={{ padding: "7px 0", borderBottom: `0.5px solid ${D.line}`, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace", color: D.orange }}>{s.ip}</span>
                    <Pill color={D.orange}>{s.count} accounts</Pill>
                  </div>
                  <div style={{ fontSize: 11, color: D.muted }}>
                    {s.users.map((u) => u.username || u.email).join(" · ")}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {[["all", "All"], ["students", "Students"], ["faculty", "Faculty"], ["premium", "Premium"], ["free", "Free"], ["expired", "Expired"], ["pending", "Pending pay"]].map(([k, l]) => (
              <button key={k} className={`ad-fp${userFilter === k ? " on" : ""}`} onClick={() => setUserFilter(k)}>{l}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
            <input className="ad-input" value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search name or email…" style={{ flex: 1, minWidth: 160 }} />
            <select className="ad-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="joined">Sort: Joined</option>
              <option value="name">Sort: Name</option>
              <option value="last">Sort: Last active</option>
              <option value="logins">Sort: Logins</option>
              <option value="expiry">Sort: Expiry</option>
            </select>
            <button className="ad-btn ghost" onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>{sortDir === "asc" ? "↑" : "↓"}</button>
            <button className="ad-btn ghost" onClick={exportCsv} disabled={!filteredUsers.length}>⬇ CSV</button>
          </div>

          <div className="ad-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${D.line}`, fontSize: 11, fontWeight: 700, color: D.gold, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "Syne,sans-serif" }}>
              {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
            </div>
            <div style={{ maxHeight: 480, overflowY: "auto" }}>
              {!loaded.users ? <Spinner /> : filteredUsers.length === 0 ? <Empty text="No users match." /> : (
                filteredUsers.slice(0, 300).map((u, i) => {
                  const active = isActiveSub(u);
                  const expiredU = u.isActivated && isExpired(u);
                  return (
                    <div
                      key={u.id}
                      className="ad-row clickable"
                      onClick={() => setDrawerUser(u.id)}
                      style={{
                        display: "grid", gridTemplateColumns: "minmax(0,1.6fr) 70px 76px 66px 60px",
                        gap: 8, padding: "10px 14px", alignItems: "center",
                        borderBottom: i < filteredUsers.length - 1 ? `0.5px solid ${D.line}` : "none",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username || "—"}</div>
                        <div style={{ fontSize: 10, color: D.hint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</div>
                      </div>
                      <div><Pill color={ROLE_COLORS[u.role] || D.muted}>{u.role?.slice(0, 4)}</Pill></div>
                      <div style={{ fontSize: 10.5, color: u.planType ? D.goldBright : D.hint }}>
                        {u.planType ? PLAN_LABELS[u.planType] || u.planType : "—"}
                      </div>
                      <div>
                        {u.role !== "STUDENT"
                          ? <span style={{ fontSize: 10, color: D.hint }}>staff</span>
                          : active ? <Pill color={D.green}>active</Pill>
                          : expiredU ? <Pill color={D.red}>expired</Pill>
                          : <span style={{ fontSize: 10, color: D.hint }}>free</span>}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: (loginCountByUser[u.id] || 0) > 0 ? D.goldBright : D.hint, textAlign: "right" }}>
                        {loginCountByUser[u.id] || 0}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {filteredUsers.length > 300 && <div style={{ padding: "8px 14px", fontSize: 10, color: D.hint, borderTop: `0.5px solid ${D.line}` }}>Showing first 300 — refine your search</div>}
          </div>
        </>
      )}

      {/* ── REPORTS ── */}
      {sub === "reports" && (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {[["open", "Open"], ["reviewed", "Reviewed"], ["dismissed", "Dismissed"], ["all", "All"]].map(([k, l]) => (
              <button key={k} className={`ad-fp${reportStatus === k ? " on" : ""}`} onClick={() => { setReportStatus(k); loadReports(k); }}>{l}</button>
            ))}
          </div>
          {!reports ? <Spinner /> : reports.length === 0 ? (
            <div className="ad-card"><Empty text={`No ${reportStatus} reports. 🎉`} /></div>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="ad-card" style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                      <Pill color={D.orange}>{REPORT_REASONS[r.reason] || r.reason}</Pill>
                      <Pill color={D.muted}>{r.targetType}</Pill>
                      <Pill color={r.status === "open" ? D.red : r.status === "reviewed" ? D.green : D.hint}>{r.status}</Pill>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                      {r.target?.title || r.target?.name || <span style={{ color: D.hint }}>(content deleted)</span>}
                    </div>
                    <div style={{ fontSize: 11, color: D.hint }}>
                      {r.target?.subject && <span>{r.target.subject} · </span>}
                      {r.target?.uploader?.username && <span>by {r.target.uploader.username} · </span>}
                      reported by {r.reporter?.username || r.reporter?.email || "?"} · {timeAgo(r.createdAt)}
                    </div>
                    {r.note && <div style={{ fontSize: 12, color: D.muted, marginTop: 8, background: D.faint, borderRadius: 8, padding: "8px 10px" }}>"{r.note}"</div>}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {r.target && (
                      <button className="ad-btn red" style={{ fontSize: 10 }} onClick={() => setConfirm({
                        title: `Delete this ${r.targetType}?`,
                        body: `"${r.target.title || r.target.name}" will be removed permanently (soft-delete for folders).`,
                        confirmLabel: "Delete",
                        danger: true,
                        run: async () => {
                          try {
                            await api(r.targetType === "resource" ? `/api/resources/${r.targetId}` : `/admin/folders/${r.targetId}`, { token, method: "DELETE" });
                            await api(`/admin/reports/${r.id}`, { token, method: "PATCH", body: { status: "reviewed" } });
                            toast.success("Content deleted, report resolved");
                            loadReports();
                          } catch (e) { toast.error(e.message); }
                        },
                      })}>
                        🗑 Delete
                      </button>
                    )}
                    {r.status === "open" && (
                      <>
                        <button className="ad-btn green" style={{ fontSize: 10 }} onClick={async () => {
                          try { await api(`/admin/reports/${r.id}`, { token, method: "PATCH", body: { status: "reviewed" } }); loadReports(); }
                          catch (e) { toast.error(e.message); }
                        }}>✓ Resolve</button>
                        <button className="ad-btn ghost" style={{ fontSize: 10 }} onClick={async () => {
                          try { await api(`/admin/reports/${r.id}`, { token, method: "PATCH", body: { status: "dismissed" } }); loadReports(); }
                          catch (e) { toast.error(e.message); }
                        }}>Dismiss</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {/* ── AI USAGE ── */}
      {sub === "ai" && (
        <>
          {!aiUsage ? <Spinner /> : (
            <>
              <div className="ad-kpis">
                <Kpi icon="🤖" label="Total calls" value={aiUsage.total} sub="last 30 days" color={D.purple} />
                <Kpi icon="📈" label="Daily avg" value={Math.round(aiUsage.total / 30)} color={D.purple} />
                <Kpi icon="👤" label="Heavy users" value={aiUsage.topUsers.length} color={D.orange} />
                <Kpi icon="🔌" label="Endpoints" value={aiUsage.byEndpoint.length} />
              </div>
              <div className="ad-card">
                <div className="ad-title">AI calls per day — 30 days</div>
                <DualChart days={aiUsage.days} a={aiUsage.perDay} b={aiUsage.perDay.map(() => 0)} labelA="Calls" labelB="" />
              </div>
              <div className="ad-two">
                <div className="ad-card">
                  <div className="ad-title">By endpoint</div>
                  <HBar items={aiUsage.byEndpoint.slice(0, 10)} color={D.purple} />
                </div>
                <div className="ad-card">
                  <div className="ad-title">Top users</div>
                  {aiUsage.topUsers.length === 0 ? <Empty text="No usage." /> : (
                    aiUsage.topUsers.map((u, i) => (
                      <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", fontSize: 12, borderBottom: i < aiUsage.topUsers.length - 1 ? `0.5px solid ${D.line}` : "none" }}>
                        <span style={{ width: 16, color: D.hint, fontWeight: 700 }}>{i + 1}</span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.username || u.email}</span>
                        <Pill color={D.purple}>{u.count}</Pill>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ── REVENUE ── */}
      {sub === "revenue" && (
        <>
          {!revenue ? <Spinner /> : (
            <>
              <div className="ad-kpis">
                <Kpi icon="💰" label="Est. MRR" value={`₦${revenue.mrr.toLocaleString()}`} color={D.goldBright} sub="monthly equivalent" />
                <Kpi icon="⭐" label="Active subs" value={revenue.activeCount} color={D.green} />
                <Kpi icon="⏰" label="Expiring 7d" value={revenue.expiringSoon.length} color={revenue.expiringSoon.length ? D.orange : D.hint} />
                <Kpi icon="📉" label="Expired" value={revenue.expiredCount} color={D.red} />
              </div>

              <div className="ad-card">
                <div className="ad-title">Subscribers by plan</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {Object.keys(revenue.planLabels || PLAN_LABELS).map((p) => (
                    <div key={p} style={{ background: D.faint, border: `0.5px solid ${D.line}`, borderRadius: 12, padding: "10px 16px", textAlign: "center", minWidth: 100 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: D.goldBright, fontFamily: "Syne,sans-serif" }}>{revenue.byPlan[p] || 0}</div>
                      <div style={{ fontSize: 10, color: D.hint }}>{PLAN_LABELS[p]} · ₦{(revenue.planPrices?.[p] || 0).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              {revenue.expiringSoon.length > 0 && (
                <div className="ad-card">
                  <div className="ad-title">⏰ Expiring within 7 days — renewal nudge list</div>
                  {revenue.expiringSoon.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 12, borderBottom: `0.5px solid ${D.line}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.username || s.email}</div>
                        <div style={{ fontSize: 10, color: D.hint }}>{PLAN_LABELS[s.planType] || s.planType}</div>
                      </div>
                      <Pill color={D.orange}>{new Date(s.activationExpiry).toLocaleDateString()}</Pill>
                    </div>
                  ))}
                </div>
              )}

              {revenue.pendingVerification.length > 0 && (
                <div className="ad-card">
                  <div className="ad-title">💳 Pending payment verification</div>
                  {revenue.pendingVerification.map((s) => (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 12, borderBottom: `0.5px solid ${D.line}` }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{s.username || s.email}</div>
                        <div style={{ fontSize: 10, color: D.hint, fontFamily: "monospace" }}>{s.transactionId}</div>
                      </div>
                      <Pill color={D.orange}>{PLAN_LABELS[s.planType] || "—"}</Pill>
                      <button className="ad-btn green" style={{ fontSize: 10 }} onClick={() => setConfirm({
                        title: `Approve ${s.username || s.email}'s payment?`,
                        body: `Activates their ${PLAN_LABELS[s.planType] || "month1"} plan now — same as a verified Paystack payment (stacks onto any live subscription).`,
                        confirmLabel: "Approve & activate",
                        run: async () => {
                          try {
                            await api(`/admin/users/${s.id}/approve-payment`, { token, method: "POST", body: { plan: s.planType } });
                            toast.success("Payment approved, plan activated");
                            loadRevenue();
                          } catch (e) { toast.error(e.message); }
                        },
                      })}>✓</button>
                      <button className="ad-btn red" style={{ fontSize: 10 }} onClick={() => setConfirm({
                        title: `Reject ${s.username || s.email}'s payment?`,
                        body: "Marks the payment as rejected. The user stays unactivated.",
                        confirmLabel: "Reject",
                        danger: true,
                        run: async () => {
                          try {
                            await api(`/admin/users/${s.id}/reject-payment`, { token, method: "POST" });
                            toast.success("Payment rejected");
                            loadRevenue();
                          } catch (e) { toast.error(e.message); }
                        },
                      })}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── ACTIVITY — audit trail ── */}
      {sub === "activity" && (
        <div className="ad-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `0.5px solid ${D.line}`, fontSize: 11, fontWeight: 700, color: D.gold, letterSpacing: "0.07em", textTransform: "uppercase", fontFamily: "Syne,sans-serif" }}>
            🧾 Security &amp; admin audit trail
          </div>
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {!activity ? <Spinner /> : activity.length === 0 ? <Empty text="No events recorded yet — admin actions and security events will appear here." /> : (
              activity.map((e, i) => (
                <div key={e.id} className="ad-row" style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", fontSize: 12, borderBottom: i < activity.length - 1 ? `0.5px solid ${D.line}` : "none" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <span style={{ fontWeight: 600 }}>{EVENT_LABELS[e.eventType] || e.eventType}</span>
                      {e.target && <span style={{ color: D.muted }}> → {e.target}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: D.hint }}>
                      by {e.actor}
                      {e.ip && <span> · <span style={{ fontFamily: "monospace" }}>{e.ip}</span></span>}
                      {e.details?.plan && <span> · {PLAN_LABELS[e.details.plan] || e.details.plan}</span>}
                      {e.details?.title && <span> · "{e.details.title}"</span>}
                      {e.details?.email && <span> · {e.details.email}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: D.muted, whiteSpace: "nowrap" }}>{timeAgo(e.createdAt)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── BROADCAST ── */}
      {sub === "broadcast" && (
        <div className="ad-card" style={{ maxWidth: 520 }}>
          <div className="ad-title">📣 Send push notification</div>
          <div style={{ fontSize: 11.5, color: D.muted, marginBottom: 14 }}>
            Reaches every subscribed device. Use sparingly — this goes straight to users' lock screens.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <select className="ad-input" value={bcRole} onChange={(e) => setBcRole(e.target.value)}>
              <option value="">Everyone</option>
              <option value="STUDENT">Students only</option>
              <option value="LECTURER">Lecturers only</option>
              <option value="TEACHER">Teachers only</option>
            </select>
            <input className="ad-input" value={bcTitle} onChange={(e) => setBcTitle(e.target.value)} placeholder="Title (e.g. New semester materials are live!)" maxLength={80} />
            <textarea className="ad-input" value={bcBody} onChange={(e) => setBcBody(e.target.value)} placeholder="Body text…" rows={3} maxLength={200} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 10, color: D.hint }}>{bcBody.length}/200</span>
              <button
                className="ad-btn gold"
                disabled={!bcTitle.trim() || bcSending}
                onClick={() => setConfirm({
                  title: "Send broadcast?",
                  body: `"${bcTitle}" goes to ${bcRole ? bcRole.toLowerCase() + "s" : "everyone"}'s devices right now.`,
                  confirmLabel: "Send now",
                  run: sendBroadcast,
                })}
              >
                {bcSending ? "Sending…" : "🚀 Send broadcast"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User drawer */}
      {drawerUser && (
        <UserDrawer
          userId={drawerUser}
          token={token}
          onClose={() => setDrawerUser(null)}
          onChanged={() => { loadUsers(); if (loaded.overview) loadOverview(); }}
        />
      )}

      {/* Shared confirm modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          onClose={() => setConfirm(null)}
          onConfirm={async () => { const run = confirm.run; setConfirm(null); await run(); }}
        />
      )}
    </div>
  );
}
