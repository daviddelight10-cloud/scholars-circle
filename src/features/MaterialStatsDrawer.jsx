import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/appUtils";
import ShareSheet from "./research-hub/ShareSheet.jsx";

const C = {
  bg: "#0d0f20", card: "#11132a", line: "#1e2245",
  text: "#e8eaf6", muted: "#8b92c4", hint: "#4a5080",
  gold: "#DAA520", goldBright: "#FFD700",
  green: "#34d399", red: "#f87171", orange: "#fb923c", purple: "#c084fc", teal: "#5eead4",
};

function timeAgo(ts) {
  const s = (Date.now() - new Date(ts).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function MiniChart({ days, data }) {
  const max = Math.max(...data, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 56 }}>
      {days.map((day, i) => {
        const d = new Date(day);
        const isToday = day === new Date().toDateString();
        return (
          <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }} title={`${d.getMonth() + 1}/${d.getDate()}: ${data[i]} views`}>
            <div style={{ width: "100%", height: `${Math.max(3, (data[i] / max) * 48)}px`, background: isToday ? C.gold : "#3a3f7a", borderRadius: 2 }} />
            {i % 5 === 0 && <div style={{ fontSize: 7.5, color: C.hint }}>{d.getMonth() + 1}/{d.getDate()}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color = C.goldBright }) {
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "Syne,sans-serif" }}>{value}</div>
      <div style={{ fontSize: 9.5, color: C.hint, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "Syne,sans-serif", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

export default function MaterialStatsDrawer({ resourceId, token, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showShare, setShowShare] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api(`/api/resources/${resourceId}/analytics`, { token })); }
    catch (e) { setError(e.message); }
  }, [resourceId, token]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,6,12,0.7)", zIndex: 400 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(440px,100vw)",
        background: C.bg, borderLeft: `0.5px solid ${C.line}`, zIndex: 401,
        overflowY: "auto", padding: 18,
      }}>
        {!data && !error && <div style={{ padding: 40, textAlign: "center", color: C.hint, fontSize: 12 }}>⏳ Loading analytics…</div>}
        {error && <div style={{ padding: 40, textAlign: "center", color: C.red, fontSize: 12 }}>{error}</div>}
        {data && (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "Syne,sans-serif", lineHeight: 1.3 }}>{data.resource.title}</div>
                <div style={{ fontSize: 10.5, color: C.hint, marginTop: 3 }}>{data.resource.contentType} · uploaded {timeAgo(data.resource.createdAt)}</div>
              </div>
              <button onClick={() => setShowShare(true)} style={{ background: "rgba(218,165,32,0.15)", border: `0.5px solid ${C.gold}55`, color: C.goldBright, borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>🔗 Share</button>
              <button onClick={onClose} style={{ background: C.card, border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}>✕</button>
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
              <Stat label="Views" value={data.views.total} />
              <Stat label="Students (30d)" value={data.views.unique30d} color={C.teal} />
              <Stat label="Bookmarks" value={data.engagement.bookmarks} color={C.purple} />
              <Stat label="Likes" value={data.engagement.likes} color={C.pink || "#f48fb1"} />
              <Stat label="Rating" value={data.engagement.ratingCount ? `${data.engagement.avgRating}★` : "—"} color={C.gold} />
              <Stat label="Comments" value={data.engagement.comments} color={C.muted} />
            </div>

            {/* Views trend */}
            <Section title="Views — last 30 days">
              <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
                <MiniChart days={data.views.days} data={data.views.perDay} />
              </div>
            </Section>

            {/* Quiz analytics */}
            {data.quiz && (
              <Section title={`Quiz performance — ${data.quiz.attempts} attempt${data.quiz.attempts !== 1 ? "s" : ""}`}>
                <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <span style={{ color: C.muted }}>Average score</span>
                    <span style={{ fontWeight: 800, color: data.quiz.avgPct >= 60 ? C.green : data.quiz.avgPct >= 40 ? C.orange : C.red }}>{data.quiz.avgPct}%</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginTop: 6 }}>
                    <span style={{ color: C.muted }}>Students who attempted</span>
                    <span style={{ fontWeight: 700 }}>{data.quiz.uniqueTakers}</span>
                  </div>
                </div>
                {data.quiz.questionStats.length > 0 && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 10, color: C.hint, marginBottom: 6 }}>Most-missed questions — re-teach these</div>
                    {data.quiz.questionStats.slice(0, 5).map((q) => (
                      <div key={q.index} style={{ marginBottom: 8 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 11.5, marginBottom: 3 }}>
                          <span style={{ color: C.text, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Q{q.index + 1}. {q.question}</span>
                          <span style={{ color: q.missRate >= 60 ? C.red : q.missRate >= 40 ? C.orange : C.muted, fontWeight: 700, flexShrink: 0 }}>{q.missRate}%</span>
                        </div>
                        <div style={{ height: 5, background: C.card, borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${q.missRate}%`, height: "100%", background: q.missRate >= 60 ? C.red : C.orange, borderRadius: 3 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {data.quiz.struggling.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, color: C.hint, marginBottom: 6 }}>⚠️ Students scoring under 50%</div>
                    {data.quiz.struggling.map((s) => (
                      <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 11.5, borderBottom: `0.5px solid ${C.line}` }}>
                        <span>{s.username || s.email}</span>
                        <span style={{ color: C.red, fontWeight: 700 }}>{s.avgPct}% · {s.attempts} tries</span>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Viewers */}
            <Section title={`Who opened it (${data.viewers.length})`}>
              {data.viewers.length === 0 ? (
                <div style={{ fontSize: 11.5, color: C.hint }}>No registered views in the last 30 days. Guest views aren't named.</div>
              ) : (
                <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
                  {data.viewers.slice(0, 15).map((v, i) => (
                    <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: 12, borderBottom: i < Math.min(data.viewers.length, 15) - 1 ? `0.5px solid ${C.line}` : "none" }}>
                      <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.username || v.email}</div>
                      <span style={{ fontSize: 10, color: C.hint }}>{v.viewCount > 1 ? `${v.viewCount}× · ` : ""}{timeAgo(v.lastViewed)}</span>
                    </div>
                  ))}
                  {data.viewers.length > 15 && <div style={{ padding: "7px 12px", fontSize: 10, color: C.hint }}>+{data.viewers.length - 15} more</div>}
                </div>
              )}
            </Section>

            {/* Comments */}
            {data.comments.length > 0 && (
              <Section title="Recent comments">
                {data.comments.map((c) => (
                  <div key={c.id} style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", marginBottom: 6, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, color: C.goldBright }}>{c.user?.username || "?"}</span>
                      <span style={{ fontSize: 10, color: C.hint }}>{timeAgo(c.createdAt)}</span>
                    </div>
                    <div style={{ color: C.muted }}>{c.text}</div>
                  </div>
                ))}
              </Section>
            )}
          </>
        )}
      </div>
      {data && (
        <div className="mc-root" style={{ display: "contents" }}>
          <ShareSheet
            open={showShare}
            target={{
              type: "resource",
              id: data.resource.id,
              shareToken: data.resource.shareToken,
              title: data.resource.title,
              meta: data.resource.subject,
              contentType: data.resource.contentType,
              linkShared: data.resource.linkShared,
              isOwner: true,
            }}
            allowAnnounce
            onClose={() => setShowShare(false)}
          />
        </div>
      )}
    </>
  );
}
