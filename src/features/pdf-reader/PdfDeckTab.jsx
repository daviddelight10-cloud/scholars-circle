import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../../lib/constants";
import QuestionMeta from "../streak-survival/QuestionMeta.jsx";

const cacheKey = (rid) => `sc_pdf_deck_${rid}`;
const starKey = (rid) => `sc_pdf_deck_star_${rid}`;
const readJson = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || "") ?? fb; } catch { return fb; } };

function authToken() {
  try { return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}").authToken || null; } catch { return null; }
}

// Loads the user's saved questions for this document: the deck they build
// from AI chat ("＋ Add to deck") plus the practice set generated from it.
// Cache-first, refreshed whenever the panel opens or a question is added.
export function usePdfDeck(resourceId, active) {
  const [data, setData] = useState(() => (resourceId ? readJson(cacheKey(resourceId), null) : null));
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const token = authToken();
    if (!resourceId || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/deck/${resourceId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
      try { localStorage.setItem(cacheKey(resourceId), JSON.stringify(json)); } catch { /* quota */ }
    } catch { /* offline: keep cache */ } finally { setLoading(false); }
  }, [resourceId]);

  useEffect(() => { if (active) refresh(); }, [active, refresh]);
  useEffect(() => {
    const on = () => { if (active) refresh(); };
    window.addEventListener("sc-fsrs-rated", on);
    return () => window.removeEventListener("sc-fsrs-rated", on);
  }, [active, refresh]);

  const items = useMemo(() => {
    if (!data) return [];
    const chat = (data.mcqData || []).map((q, i) => ({ q, key: `c:${i}`, source: "chat" }));
    const gen = (data.generated?.mcqData || []).map((q, i) => ({ q, key: `g:${i}`, source: "generated" }));
    return [...chat.reverse(), ...gen];
  }, [data]);

  return { data, items, loading, refresh };
}

function mcqStem(q) {
  if (!q || typeof q !== "object") return "";
  for (const k of ["question", "q", "stem", "text", "questionText", "body"]) {
    const v = q[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function Card({ item, T, starred, onStar, onJump }) {
  const [open, setOpen] = useState(false);
  const { q } = item;
  const stem = mcqStem(q);
  const letters = Object.keys(q.options || {}).sort();
  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 12, background: T.hover, padding: "11px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".05em", textTransform: "uppercase", color: T.muted }}>{item.source === "chat" ? "From chat" : "Generated"}</span>
        <span style={{ flex: 1 }} />
        {q._srcPage && (
          <button onClick={() => onJump(q._srcPage)} style={{ border: `1px solid ${T.border}`, background: "transparent", color: T.accent, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>p. {q._srcPage}</button>
        )}
        <button onClick={onStar} aria-label={starred ? "Remove star" : "Star question"} aria-pressed={starred} style={{ border: 0, background: "transparent", cursor: "pointer", fontSize: 17, lineHeight: 1, color: starred ? "#F5A623" : T.muted, padding: 4 }}>{starred ? "★" : "☆"}</button>
      </div>
      {(q.topic || q.difficulty || q.qtype) && <div style={{ marginBottom: 6 }}><QuestionMeta q={q} /></div>}
      <div role="button" tabIndex={0} onClick={() => setOpen((v) => !v)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }} style={{ cursor: "pointer" }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: T.text, lineHeight: 1.45, marginBottom: 8 }}>{stem}</div>
        {letters.map((k) => {
          const right = open && k === q.correct;
          return (
            <div key={k} style={{ display: "flex", gap: 8, padding: "6px 8px", marginBottom: 4, borderRadius: 8, fontSize: 12.5, lineHeight: 1.4, color: right ? "#2f9e6a" : T.text, background: right ? "rgba(61,220,151,.14)" : "transparent", border: `1px solid ${right ? "rgba(61,220,151,.5)" : T.border}` }}>
              <b style={{ flex: "none", color: right ? "#2f9e6a" : T.muted }}>{k}</b><span style={{ flex: 1 }}>{q.options[k]}</span>{right && <b>✓</b>}
            </div>
          );
        })}
        {open && q.explanation && <div style={{ marginTop: 6, fontSize: 12, color: T.muted, lineHeight: 1.5 }}>{q.explanation}</div>}
        {open && q._quote && <div style={{ marginTop: 6, fontSize: 11.5, color: T.muted, fontStyle: "italic", borderLeft: `2px solid ${T.border}`, paddingLeft: 8 }}>“{q._quote}”</div>}
        {!open && <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>Tap to reveal the answer</div>}
      </div>
    </div>
  );
}

export default function PdfDeckTab({ resourceId, T, deck, onJump }) {
  const navigate = useNavigate();
  const { data, items, loading } = deck;
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [stars, setStars] = useState(() => new Set(readJson(starKey(resourceId), [])));

  const toggleStar = (key) => setStars((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    try { localStorage.setItem(starKey(resourceId), JSON.stringify([...next])); } catch { /* quota */ }
    return next;
  });

  const counts = useMemo(() => ({
    chat: items.filter((i) => i.source === "chat").length,
    generated: items.filter((i) => i.source === "generated").length,
    starred: items.filter((i) => stars.has(i.key)).length,
  }), [items, stars]);

  const topics = useMemo(() => {
    const m = new Map();
    items.forEach((i) => { const t = (i.q.topic || "").trim(); if (t) m.set(t.toLowerCase(), t); });
    return [...m.values()];
  }, [items]);

  const shown = useMemo(() => {
    const s = search.trim().toLowerCase();
    return items.filter((i) => {
      if (topic && (i.q.topic || "").trim().toLowerCase() !== topic.toLowerCase()) return false;
      if (filter === "chat" && i.source !== "chat") return false;
      if (filter === "generated" && i.source !== "generated") return false;
      if (filter === "starred" && !stars.has(i.key)) return false;
      if (!s) return true;
      return `${mcqStem(i.q)} ${i.q.topic || ""} ${Object.values(i.q.options || {}).join(" ")}`.toLowerCase().includes(s);
    });
  }, [items, filter, search, stars, topic]);

  const startToken = filter === "generated" ? data?.generated?.shareToken : (filter === "chat" ? data?.shareToken : (data?.shareToken || data?.generated?.shareToken));
  const chip = (id, label, n) => (
    <button key={id} onClick={() => setFilter(id)} aria-pressed={filter === id} style={{ border: `1px solid ${filter === id ? T.accent : T.border}`, background: filter === id ? T.accent : "transparent", color: filter === id ? "#fff" : T.muted, borderRadius: 999, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>{label} {n}</button>
  );

  if (!items.length) {
    return (
      <div style={{ padding: "26px 8px", textAlign: "center", color: T.muted, fontSize: 12.5, lineHeight: 1.6 }}>
        {loading ? "Loading your deck…" : (
          <>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🗂️</div>
            <b style={{ color: T.text, fontSize: 14 }}>No saved questions yet</b>
            <div style={{ marginTop: 4 }}>Ask the AI to quiz you on this document, then tap <b>＋ Add to deck</b> on any question. Generated practice sets for this material also appear here.</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {chip("all", "All", items.length)}
        {counts.chat > 0 && chip("chat", "From chat", counts.chat)}
        {counts.generated > 0 && chip("generated", "Generated", counts.generated)}
        {counts.starred > 0 && chip("starred", "★ Starred", counts.starred)}
      </div>
      {topics.length >= 2 && (
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
          {topics.map((t) => (
            <button key={t} onClick={() => setTopic(topic === t ? "" : t)} aria-pressed={topic === t} style={{ flex: "none", border: `1px solid ${topic === t ? T.accent : T.border}`, background: topic === t ? T.accent : "transparent", color: topic === t ? "#fff" : T.muted, borderRadius: 999, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{t}</button>
          ))}
        </div>
      )}
      {items.length > 8 && (
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search questions or topics" aria-label="Search saved questions" style={{ height: 38, padding: "0 12px", borderRadius: 10, border: `1px solid ${T.border}`, background: T.inputBg, color: T.text, fontSize: 13 }} />
      )}
      {shown.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: T.muted, textAlign: "center" }}>No questions match.</div>}
      {shown.map((item) => (
        <Card key={item.key} item={item} T={T} starred={stars.has(item.key)} onStar={() => toggleStar(item.key)} onJump={onJump} />
      ))}
      {startToken && (
        <button onClick={() => navigate(`/resources/${startToken}`)} style={{ position: "sticky", bottom: 0, height: 46, border: 0, borderRadius: 13, background: "linear-gradient(180deg,#FFC857,#F5A623)", color: "#151005", fontWeight: 800, fontSize: 14, cursor: "pointer", boxShadow: "0 6px 16px rgba(245,166,35,.3)" }}>▶ Start recall</button>
      )}
    </div>
  );
}
