import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/appUtils";
import { getContentTypeIcon } from "../lib/researchUtils";
import MaterialStatsDrawer from "./MaterialStatsDrawer";
import ShareSheet from "./research-hub/ShareSheet.jsx";

const C = {
  bg: "#0d0f20", card: "#11132a", line: "#1e2245",
  text: "#e8eaf6", muted: "#8b92c4", hint: "#4a5080",
  gold: "#DAA520", goldBright: "#FFD700",
  green: "#34d399", red: "#f87171", orange: "#fb923c", purple: "#c084fc", teal: "#5eead4", pink: "#f48fb1",
};

function timeAgo(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function BigChart({ days, data }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
      {days.map((day, i) => {
        const d = new Date(day);
        const isToday = day === new Date().toDateString();
        return (
          <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }} title={`${d.getMonth() + 1}/${d.getDate()}: ${data[i]} views`}>
            <div style={{ width: "100%", height: `${Math.max(3, (data[i] / max) * 64)}px`, background: isToday ? "linear-gradient(180deg,#DAA520,#8a6d0b)" : "#3a3f7a", borderRadius: 3 }} />
            {i % 5 === 0 && <div style={{ fontSize: 8, color: isToday ? C.gold : C.hint }}>{d.getMonth() + 1}/{d.getDate()}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Kpi({ icon, label, value, color = C.goldBright }) {
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{icon}</span>
        <span style={{ fontSize: 9, color: C.hint, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 800, color, fontFamily: "Syne,sans-serif", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "Syne,sans-serif", marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

const btn = {
  background: "rgba(218,165,32,0.12)", border: `0.5px solid ${C.gold}44`, color: C.goldBright,
  borderRadius: 7, padding: "5px 10px", fontSize: 10.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
};

export default function LecturerInsights({ token }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [statsId, setStatsId] = useState(null);
  const [shareTarget, setShareTarget] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api("/api/resources/teacher/insights", { token })); }
    catch (e) { setError(e.message); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  if (error) return <div style={{ padding: 32, textAlign: "center", color: C.red, fontSize: 12 }}>{error}</div>;
  if (!data) return <div style={{ padding: 32, textAlign: "center", color: C.hint, fontSize: 12 }}>⏳ Loading your impact…</div>;
  if (data.empty) return (
    <div style={{ padding: 32, textAlign: "center", color: C.hint, fontSize: 12 }}>
      📭 No materials yet — upload your first resource and your impact dashboard comes alive here.
    </div>
  );

  const t = data.totals;

  return (
    <div>
      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 12 }}>
        <Kpi icon="📄" label="Materials" value={t.materials} />
        <Kpi icon="👀" label="Total views" value={t.views} />
        <Kpi icon="🎓" label="Students reached" value={t.students} color={C.teal} />
        <Kpi icon="✍️" label="Quiz attempts" value={t.attempts} color={C.purple} />
        <Kpi icon="🔖" label="Bookmarks" value={t.bookmarks} color={C.pink} />
        <Kpi icon="❤️" label="Likes" value={t.likes} color={C.pink} />
        <Kpi icon="⭐" label="Avg rating" value={t.avgRating || "—"} color={C.gold} />
        <Kpi icon="💬" label="Comments" value={t.comments} color={C.muted} />
      </div>

      <style>{`@media (max-width:640px){ .li-kpis{grid-template-columns:repeat(2,1fr)!important} }`}</style>

      {/* Views trend */}
      <Card title="Views across all your materials — 30 days">
        <BigChart days={data.days} data={data.viewsPerDay} />
      </Card>

      {/* Struggling students */}
      {data.struggling.length > 0 && (
        <Card title="⚠️ Students struggling on your materials">
          <div style={{ fontSize: 11, color: C.hint, marginBottom: 8 }}>
            Averaging under 50% on your quizzes — worth reaching out or posting a review session.
          </div>
          {data.struggling.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", fontSize: 12, borderBottom: i < data.struggling.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.username || s.email}</div>
              <span style={{ color: C.red, fontWeight: 700, fontSize: 11.5 }}>{s.avgPct}% · {s.attempts} attempts</span>
            </div>
          ))}
        </Card>
      )}

      {/* Top materials */}
      <Card title="🏆 Your top materials">
        {data.topMaterials.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: i < data.topMaterials.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
            <span style={{ fontSize: 16 }}>{getContentTypeIcon(r.contentType)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
              <div style={{ fontSize: 10, color: C.hint }}>
                {r.viewCount} views{r.views30d ? ` · ${r.views30d} this month` : ""}{r.ratingCount ? ` · ${r.avgRating}★` : ""}
              </div>
            </div>
            <button style={btn} onClick={() => setStatsId(r.id)}>📊 Stats</button>
            <button style={btn} onClick={() => setShareTarget({ type: "resource", id: r.id, shareToken: r.shareToken, title: r.title, contentType: r.contentType, linkShared: r.linkShared, isOwner: true })}>🔗 Share</button>
          </div>
        ))}
      </Card>

      {/* Comments inbox */}
      <Card title="💬 Latest comments on your materials">
        {data.comments.length === 0 ? (
          <div style={{ fontSize: 11.5, color: C.hint }}>No comments yet.</div>
        ) : (
          data.comments.map((c) => (
            <div key={c.id} style={{ padding: "8px 0", borderBottom: `0.5px solid ${C.line}`, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span style={{ fontWeight: 600, color: C.goldBright }}>{c.user?.username || "?"}</span>
                <span style={{ fontSize: 10, color: C.hint }}>{timeAgo(c.createdAt)}</span>
              </div>
              <div style={{ color: C.muted, marginBottom: 3 }}>{c.text}</div>
              <div style={{ fontSize: 10, color: C.hint }}>on {c.resource?.title}</div>
            </div>
          ))
        )}
      </Card>

      {statsId && <MaterialStatsDrawer resourceId={statsId} token={token} onClose={() => setStatsId(null)} />}
      <div className="mc-root" style={{ display: "contents" }}>
        <ShareSheet
          open={!!shareTarget}
          target={shareTarget}
          allowAnnounce
          onClose={() => setShareTarget(null)}
        />
      </div>
    </div>
  );
}
