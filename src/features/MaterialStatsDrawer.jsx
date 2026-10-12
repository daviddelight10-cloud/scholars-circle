import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/appUtils";
import { toast } from "../components/Toast";
import ShareSheet from "./research-hub/ShareSheet.jsx";
import McIcon from "./research-hub/McIcon.jsx";

const C = {
  bg: "#0B0B0D", card: "#151518", line: "#26262B",
  text: "#F2F0EA", muted: "#8A8F9C", hint: "#5B606C",
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

// Content type → sprite glyph (insights surfaces don't use emoji)
export function typeIcon(type) {
  const map = { pdf: "filetext", docx: "filetext", txt: "filetext", note: "filetext", pptx: "chart", image: "image", mcq: "list", flashcard_deck: "grid", tutorial_question: "pen", exam: "grad" };
  return map[type] || "filetext";
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
            <div style={{ width: "100%", height: `${Math.max(3, (data[i] / max) * 48)}px`, background: isToday ? C.gold : "#3A3A41", borderRadius: 2 }} />
            {i % 5 === 0 && <div style={{ fontSize: 7.5, color: C.hint }}>{d.getMonth() + 1}/{d.getDate()}</div>}
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color = C.goldBright, sub }) {
  return (
    <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 18, fontWeight: 800, color, fontFamily: "Syne,sans-serif" }}>{value}</div>
      {sub && <div style={{ fontSize: 9, color: C.muted, marginTop: 1 }}>{sub}</div>}
      <div style={{ fontSize: 9.5, color: C.hint, textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: C.gold, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "Syne,sans-serif", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        {icon && <McIcon name={icon} size={13} />}
        {title}
      </div>
      {children}
    </div>
  );
}

function Chip({ icon, text, color = C.muted }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color, background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 999, padding: "3px 9px" }}>
      <McIcon name={icon} size={11} /> {text}
    </span>
  );
}

// ── Student detail panel — slides in over the drawer's main content ──
function StudentPanel({ student, studentId, resourceTitle, token, onBack }) {
  const [msgOpen, setMsgOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const s = student;
  const hasCards = s.cards?.reviewed > 0;
  const hasPractice = s.practice?.attempts > 0;
  const chips = [
    s.university && { icon: "landmark", text: s.university },
    s.department && { icon: "books", text: s.department },
    s.level && { icon: "grad", text: s.level },
    s.programme && { icon: "books", text: s.programme },
  ].filter(Boolean);

  async function sendMessage() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await api("/api/messages", { method: "POST", token, body: { toUserId: studentId, content: text } });
      setSent(true); setDraft(""); setMsgOpen(false);
      toast.success(`Message sent to ${s.name}`);
    } catch (e) {
      toast.error("Couldn't send — " + (e.message || "try again"));
    } finally { setSending(false); }
  }

  return (
    <div>
      {/* Back + identity */}
      <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: C.gold, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: "0 0 14px", fontFamily: "Syne,sans-serif" }}>
        <McIcon name="chev-r" size={13} style={{ transform: "rotate(180deg)" }} /> Back to stats
      </button>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "linear-gradient(135deg,#DAA520,#8a6d0b)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 17, color: "#0B0B0D", flexShrink: 0, overflow: "hidden" }}>
          {s.avatar && /^https?:|data:image/.test(s.avatar) ? <img src={s.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (s.name || "S").charAt(0).toUpperCase()}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "Syne,sans-serif", lineHeight: 1.25 }}>{s.name}</div>
          {s.username && <div style={{ fontSize: 10.5, color: C.hint }}>@{s.username}</div>}
        </div>
      </div>
      {chips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {chips.map((c, i) => <Chip key={i} icon={c.icon} text={c.text} color={C.text} />)}
        </div>
      )}
      <div style={{ fontSize: 9.5, color: C.hint, marginBottom: 12 }}>on <span style={{ color: C.muted }}>{resourceTitle}</span></div>

      {/* Stats grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 14 }}>
        <Stat label="Opens" value={s.views?.total || 0} sub={s.views?.d30 ? `${s.views.d30} this month` : null} />
        <Stat label="Practice attempts" value={s.practice?.attempts || 0} color={C.purple} sub={s.practice?.lastAt ? `last ${timeAgo(s.practice.lastAt)}` : null} />
        <Stat label="Avg score" value={s.practice?.avgPct != null ? `${s.practice.avgPct}%` : "—"} color={s.practice?.avgPct == null ? C.hint : s.practice.avgPct >= 60 ? C.green : s.practice.avgPct >= 40 ? C.orange : C.red} />
        <Stat label="Best score" value={s.practice?.bestPct != null ? `${s.practice.bestPct}%` : "—"} color={C.teal} />
      </div>

      {hasCards && (
        <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, padding: "9px 12px", marginBottom: 14, display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: C.muted }}>
          <McIcon name="flame" size={13} style={{ color: C.gold }} />
          <span><b style={{ color: C.text }}>{s.cards.mastered}</b> cards mastered of {s.cards.reviewed} touched · {s.cards.reviews} reviews{s.cards.lastAt ? ` · last ${timeAgo(s.cards.lastAt)}` : ""}</span>
        </div>
      )}

      {/* Engagement chips — only what they did */}
      {(s.engagement?.bookmarked || s.engagement?.liked || s.engagement?.stars || s.engagement?.comments > 0) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
          {s.engagement.bookmarked && <Chip icon="bookmark" text="Bookmarked" color={C.purple} />}
          {s.engagement.liked && <Chip icon="heart" text="Liked" color={C.pink} />}
          {s.engagement.stars && <Chip icon="star" text={`Rated ${s.engagement.stars}/5`} color={C.gold} />}
          {s.engagement.comments > 0 && <Chip icon="chat" text={`${s.engagement.comments} comment${s.engagement.comments > 1 ? "s" : ""}`} color={C.teal} />}
        </div>
      )}

      {/* Recent attempts */}
      {hasPractice && (
        <Section title="Recent practice" icon="list">
          <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
            {s.practice.recent.map((a, i) => {
              const pct = a.total ? Math.round((a.score / a.total) * 100) : 0;
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", fontSize: 11.5, borderBottom: i < s.practice.recent.length - 1 ? `0.5px solid ${C.line}` : "none" }}>
                  <span style={{ fontWeight: 700, color: pct >= 60 ? C.green : pct >= 40 ? C.orange : C.red }}>{a.score}/{a.total}</span>
                  <span style={{ color: C.hint, fontSize: 10 }}>{a.mode}</span>
                  <span style={{ marginLeft: "auto", color: C.hint, fontSize: 10 }}>{timeAgo(a.at)}</span>
                </div>
              );
            })}
          </div>
        </Section>
      )}
      {!hasPractice && !hasCards && (s.views?.total || 0) > 0 && (
        <div style={{ fontSize: 11, color: C.hint, marginBottom: 14 }}>Has only viewed — no practice or reviews yet.</div>
      )}

      {/* Message */}
      <div style={{ borderTop: `0.5px solid ${C.line}`, paddingTop: 12 }}>
        {!msgOpen ? (
          <button onClick={() => setMsgOpen(true)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "rgba(218,165,32,0.12)", border: `0.5px solid ${C.gold}44`, color: C.goldBright, borderRadius: 10, padding: "10px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "Syne,sans-serif" }}>
            <McIcon name="chat" size={14} /> {sent ? "Message again" : "Message student"}
          </button>
        ) : (
          <div>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message ${s.name}…`}
              rows={3}
              style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, color: C.text, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={() => { setMsgOpen(false); setDraft(""); }} style={{ flex: 1, background: "none", border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: "8px 0", fontSize: 11.5, cursor: "pointer" }}>Cancel</button>
              <button onClick={sendMessage} disabled={sending || !draft.trim()} style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: draft.trim() ? "linear-gradient(135deg,#FFD700,#DAA520)" : C.card, border: "none", color: draft.trim() ? "#0B0B0D" : C.hint, borderRadius: 8, padding: "8px 0", fontSize: 11.5, fontWeight: 700, cursor: sending ? "wait" : "pointer" }}>
                <McIcon name="send" size={12} /> {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MaterialStatsDrawer({ resourceId, token, onClose }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [showShare, setShowShare] = useState(false);
  const [studentId, setStudentId] = useState(null);

  const load = useCallback(async () => {
    try { setData(await api(`/api/resources/${resourceId}/analytics`, { token })); }
    catch (e) { setError(e.message); }
  }, [resourceId, token]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setStudentId(null); }, [resourceId]);

  const student = studentId ? data?.students?.[studentId] : null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(5,6,12,0.7)", zIndex: 400 }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, width: "min(440px,100vw)",
        background: C.bg, borderLeft: `0.5px solid ${C.line}`, zIndex: 401,
        overflowY: "auto", padding: 18,
      }}>
        {!data && !error && <div style={{ padding: 40, textAlign: "center", color: C.hint, fontSize: 12 }}>Loading analytics…</div>}
        {error && <div style={{ padding: 40, textAlign: "center", color: C.red, fontSize: 12 }}>{error}</div>}
        {data && student && (
          <StudentPanel student={student} studentId={studentId} resourceTitle={data.resource.title} token={token} onBack={() => setStudentId(null)} />
        )}
        {data && !student && (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "Syne,sans-serif", lineHeight: 1.3 }}>{data.resource.title}</div>
                <div style={{ fontSize: 10.5, color: C.hint, marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
                  <McIcon name={typeIcon(data.resource.contentType)} size={11} /> {data.resource.contentType} · uploaded {timeAgo(data.resource.createdAt)}
                </div>
              </div>
              <button onClick={() => setShowShare(true)} style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(218,165,32,0.15)", border: `0.5px solid ${C.gold}55`, color: C.goldBright, borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                <McIcon name="share" size={12} /> Share
              </button>
              <button onClick={onClose} style={{ background: C.card, border: `0.5px solid ${C.line}`, color: C.muted, borderRadius: 8, padding: "6px 8px", cursor: "pointer", display: "flex" }}><McIcon name="x" size={13} /></button>
            </div>

            {/* KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
              <Stat label="Views" value={data.views.total} />
              <Stat label="Students (30d)" value={data.views.unique30d} color={C.teal} />
              <Stat label="Bookmarks" value={data.engagement.bookmarks} color={C.purple} />
              <Stat label="Likes" value={data.engagement.likes} color={C.pink} />
              <Stat label="Rating" value={data.engagement.ratingCount ? `${data.engagement.avgRating}★` : "—"} color={C.gold} />
              <Stat label="Comments" value={data.engagement.comments} color={C.muted} />
            </div>

            {/* Views trend */}
            <Section title="Views — last 30 days" icon="chart">
              <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
                <MiniChart days={data.views.days} data={data.views.perDay} />
              </div>
            </Section>

            {/* Quiz analytics */}
            {data.quiz && (
              <Section title={`Quiz performance — ${data.quiz.attempts} attempt${data.quiz.attempts !== 1 ? "s" : ""}`} icon="list">
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
                    <div style={{ fontSize: 10, color: C.hint, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                      <McIcon name="alert" size={11} style={{ color: C.red }} /> Students scoring under 50%
                    </div>
                    {data.quiz.struggling.map((st) => (
                      <button key={st.id} onClick={() => setStudentId(st.id)} style={{ display: "flex", alignItems: "center", width: "100%", padding: "6px 0", fontSize: 11.5, border: "none", background: "none", color: C.text, borderBottom: `0.5px solid ${C.line}`, cursor: "pointer", textAlign: "left" }}>
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.fullName || st.username || st.email}</span>
                        <span style={{ color: C.red, fontWeight: 700 }}>{st.avgPct}% · {st.attempts} tries</span>
                        <McIcon name="chev-r" size={12} style={{ color: C.hint, marginLeft: 6, flexShrink: 0 }} />
                      </button>
                    ))}
                  </div>
                )}
              </Section>
            )}

            {/* Viewers */}
            <Section title={`Who opened it (${data.viewers.length})`} icon="users">
              {data.viewers.length === 0 ? (
                <div style={{ fontSize: 11.5, color: C.hint }}>No registered views in the last 30 days. Guest views aren't named.</div>
              ) : (
                <div style={{ background: C.card, border: `0.5px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
                  {data.viewers.slice(0, 15).map((v, i) => {
                    const clickable = !!data.students?.[v.id];
                    const Row = clickable ? "button" : "div";
                    return (
                      <Row key={v.id} onClick={clickable ? () => setStudentId(v.id) : undefined} style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", fontSize: 12, border: "none", background: "none", color: C.text, borderBottom: i < Math.min(data.viewers.length, 15) - 1 ? `0.5px solid ${C.line}` : "none", cursor: clickable ? "pointer" : "default", textAlign: "left" }}>
                        <div style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: clickable ? 600 : 400 }}>{v.username || v.email}</div>
                        <span style={{ fontSize: 10, color: C.hint }}>{v.viewCount > 1 ? `${v.viewCount}× · ` : ""}{timeAgo(v.lastViewed)}</span>
                        {clickable && <McIcon name="chev-r" size={11} style={{ color: C.hint, flexShrink: 0 }} />}
                      </Row>
                    );
                  })}
                  {data.viewers.length > 15 && <div style={{ padding: "7px 12px", fontSize: 10, color: C.hint }}>+{data.viewers.length - 15} more</div>}
                </div>
              )}
            </Section>

            {/* Comments */}
            {data.comments.length > 0 && (
              <Section title="Recent comments" icon="chat">
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
