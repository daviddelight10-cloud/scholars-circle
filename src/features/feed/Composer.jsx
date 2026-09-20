import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { feedApi } from "./feedApi";
import { createLiveRoom } from "../live-quiz/liveQuizApi.js";
import { Avatar } from "./feedUi";

// The MCQ-playable variant of a material: itself if it's an MCQ set,
// else its AI-generated MCQ derived resource.
function mcqVariant(r) {
  if (!r) return null;
  if (r.contentType === "mcq" && r.mcqData) return r;
  return (r.derivedResources || []).find((d) => d.contentType === "mcq" && d.mcqData) || null;
}

function mcqQuestionCount(r) {
  const v = mcqVariant(r);
  if (!v) return 0;
  let data = v.mcqData;
  if (typeof data === "string") {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  return Array.isArray(data) ? data.length : 0;
}

export function Composer({ token, me, subjects = [], onPosted, onRoomsChanged, liveOnly }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [myResources, setMyResources] = useState([]);
  const [attached, setAttached] = useState(null);
  const [asQuestion, setAsQuestion] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const inputRef = useRef(null);

  const submit = async () => {
    const t = text.trim();
    if ((!t && !attached) || busy) return;
    setBusy(true);
    try {
      const post = await feedApi.createPost({
        token,
        text: t,
        kind: asQuestion ? "question" : "post",
        resourceId: attached?.id,
      });
      onPosted?.(post);
      setText("");
      setAttached(null);
      setAsQuestion(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (liveOnly) {
    return <GoLiveCard token={token} me={me} subjects={subjects} open={liveOpen} setOpen={setLiveOpen} onRoomsChanged={onRoomsChanged} />;
  }

  return (
    <div className="fd-composer">
      <div className="fd-composer-row">
        <Avatar user={me} size={38} />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={asQuestion ? "Ask your circle…" : "Share a resource, ask your circle…"}
        />
        <button
          className={`fd-share ${!text.trim() && !attached ? "disabled" : ""}`}
          disabled={(!text.trim() && !attached) || busy}
          onClick={submit}
        >
          {busy ? "…" : "Share"}
        </button>
      </div>

      {asQuestion && <div className="fd-composer-tag">❓ Posting as a question</div>}

      {attached && (
        <div className="fd-attached">
          <span className="fd-attached-icon">📄</span>
          <span className="fd-attached-title">{attached.title}</span>
          <button className="fd-attached-x" onClick={() => setAttached(null)}>✕</button>
        </div>
      )}

      <div className="fd-composer-pills">
        <button className="fd-pill" onClick={() => setAttachOpen(true)}>
          📄 Resource
        </button>
        <button
          className={`fd-pill ${asQuestion ? "active" : ""}`}
          onClick={() => setAsQuestion((v) => !v)}
        >
          ❓ Ask
        </button>
        <button className="fd-pill golive" onClick={() => setLiveOpen(true)}>
          🟢 Go live
        </button>
      </div>

      {attachOpen && (
        <MaterialPicker
          token={token}
          cache={myResources}
          setCache={setMyResources}
          onPick={(r) => { setAttached(r); setAttachOpen(false); }}
          onClose={() => setAttachOpen(false)}
        />
      )}

      {liveOpen && (
        <GoLiveSheet
          token={token}
          subjects={subjects}
          onClose={() => setLiveOpen(false)}
          onRoomsChanged={onRoomsChanged}
        />
      )}
    </div>
  );
}

// Library picker — your uploads + saved/bookmarked materials, deduped.
// mcqOnly narrows to materials that have MCQ questions to play.
export function MaterialPicker({ token, cache, setCache, onPick, onClose, mcqOnly }) {
  // Callers may share an external cache (attach picker) — without one, keep local state
  const [internal, setInternal] = useState(null);
  const store = setCache || setInternal;
  const items = cache ?? internal;
  const [loading, setLoading] = useState(!items?.length);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      feedApi.getMyResources({ token }).catch(() => []),
      feedApi.getMyBookmarks({ token }).catch(() => []),
      ...(mcqOnly ? [feedApi.getMcqResources({ token }).catch(() => [])] : []),
    ])
      .then(([uploads, bookmarks, community]) => {
        if (!alive) return;
        const seen = new Set();
        const merged = [];
        // Own library first, then community MCQ sets
        for (const r of [...(uploads || []), ...(bookmarks || []), ...(community || [])]) {
          if (r?.id && !seen.has(r.id)) {
            seen.add(r.id);
            merged.push(r);
          }
        }
        store(merged);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [token, mcqOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  const resources = mcqOnly ? (items || []).filter((r) => mcqVariant(r)) : (items || []);

  const filtered = resources.filter((r) =>
    !q || r.title?.toLowerCase().includes(q.toLowerCase()) || r.subject?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="fd-sheet-backdrop" onClick={onClose}>
      <div className="fd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fd-sheet-head">
          <b>{mcqOnly ? "Pick a quiz material" : "Pick a material"}</b>
          <button className="fd-icon-btn" onClick={onClose}>✕</button>
        </div>
        <input
          className="fd-sheet-search"
          placeholder="Search your library…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="fd-sheet-list">
          {loading && <div className="fd-comments-loading">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="fd-empty-sub" style={{ padding: 16 }}>
              {mcqOnly
                ? "No MCQ sets found — generate MCQs on a material in My Space first."
                : "No materials yet — upload or save resources in My Space first."}
            </div>
          )}
          {filtered.slice(0, 30).map((r) => (
            <button key={r.id} className="fd-sheet-item" onClick={() => onPick(r)}>
              <span className="fd-attached-icon">{mcqOnly ? "⚡" : "📄"}</span>
              <span className="fd-sheet-item-info">
                <span className="fd-sheet-item-title">{r.title}</span>
                <span className="fd-sheet-item-meta">
                  {[
                    r.subject,
                    mcqOnly ? `${mcqQuestionCount(r)} questions` : r.contentType,
                    r.uploader?.fullName || r.uploader?.username ? `by ${r.uploader.fullName || r.uploader.username}` : null,
                  ].filter(Boolean).join(" · ")}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoLiveSheet({ token, subjects, onClose, onRoomsChanged }) {
  const navigate = useNavigate();
  const [mode, setMode] = useState("quiz"); // "quiz" | "quiet"
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [material, setMaterial] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [seats, setSeats] = useState(8);
  const [busy, setBusy] = useState(false);

  const mcq = mcqVariant(material);
  const qCount = mcqQuestionCount(material);

  const goQuiz = async () => {
    if (!mcq || busy) return;
    setBusy(true);
    try {
      const [res] = await Promise.all([
        createLiveRoom(mcq.id),
        import("../live-quiz/LiveQuizPage"),
      ]);
      onClose();
      navigate(`/live/${res.code}`, { state: { ticket: res.ticket, roomId: res.roomId } });
    } catch (err) {
      alert(err.message);
      setBusy(false);
    }
  };

  const createQuiet = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await feedApi.createPublicRoom({
        token,
        name: name.trim() || (material ? `Studying ${material.title}` : "Focus Session"),
        subject: subject || material?.subject || undefined,
        maxSeats: seats,
        resourceId: material?.id,
      });
      onRoomsChanged?.();
      onClose();
    } catch (err) {
      alert(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="fd-sheet-backdrop" onClick={onClose}>
      <div className="fd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fd-sheet-head">
          <b>{mode === "quiz" ? "⚡ Go live — quiz battle" : "🟢 Quiet study room"}</b>
          <button className="fd-icon-btn" onClick={onClose}>✕</button>
        </div>

        <div className="fd-mode-tabs">
          <button
            className={`fd-mode-tab ${mode === "quiz" ? "active" : ""}`}
            onClick={() => setMode("quiz")}
          >
            ⚡ Quiz battle
          </button>
          <button
            className={`fd-mode-tab ${mode === "quiet" ? "active" : ""}`}
            onClick={() => setMode("quiet")}
          >
            🟢 Quiet room
          </button>
        </div>

        {mode === "quiz" ? (
          <>
            <div className="fd-sheet-sub">
              Pick a material with MCQs — your circle joins and everyone answers the same questions live.
            </div>
            <label className="fd-label">Quiz material</label>
            {material ? (
              <div className="fd-attached" style={{ margin: "0 0 10px" }}>
                <span className="fd-attached-icon">⚡</span>
                <span className="fd-attached-title">
                  {material.title} · {qCount} question{qCount === 1 ? "" : "s"}
                </span>
                <button className="fd-attached-x" onClick={() => setMaterial(null)}>✕</button>
              </div>
            ) : (
              <button className="fd-pill" style={{ marginBottom: 10 }} onClick={() => setPickerOpen(true)}>
                ⚡ Pick from your library
              </button>
            )}
            <button
              className="fd-go-btn"
              disabled={!mcq || busy}
              onClick={goQuiz}
            >
              {busy ? "Opening lobby…" : mcq ? `Go live — ${qCount} questions` : "Pick a material to go live"}
            </button>
            <div className="fd-sheet-sub" style={{ marginTop: 8 }}>
              Up to 8 friends can join your lobby.
            </div>
          </>
        ) : (
          <>
            <div className="fd-sheet-sub">Open a quiet study room — anyone in your circle can pull up a seat.</div>
            <label className="fd-label">Room name</label>
            <input
              className="fd-sheet-input"
              placeholder="e.g. Anatomy cram before the test"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="fd-label">Material (optional)</label>
            {material ? (
              <div className="fd-attached" style={{ margin: "0 0 10px" }}>
                <span className="fd-attached-icon">📄</span>
                <span className="fd-attached-title">{material.title}</span>
                <button className="fd-attached-x" onClick={() => setMaterial(null)}>✕</button>
              </div>
            ) : (
              <button className="fd-pill" style={{ marginBottom: 10 }} onClick={() => setPickerOpen(true)}>
                📄 Pick from your library
              </button>
            )}
            <label className="fd-label">Subject (optional)</label>
            <select className="fd-sheet-input" value={subject || material?.subject || ""} onChange={(e) => setSubject(e.target.value)}>
              <option value="">{material?.subject ? `${material.subject} (from material)` : "Open study"}</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.label}>{s.label}</option>
              ))}
            </select>
            <label className="fd-label">Seats</label>
            <input
              className="fd-sheet-input"
              type="number"
              min={2}
              max={50}
              value={seats}
              onChange={(e) => setSeats(Math.min(Math.max(parseInt(e.target.value) || 8, 2), 50))}
            />
            <button className="fd-go-btn" disabled={busy} onClick={createQuiet}>
              {busy ? "Opening…" : "Open the room"}
            </button>
          </>
        )}
      </div>
      {pickerOpen && (
        <MaterialPicker
          token={token}
          mcqOnly={mode === "quiz"}
          onPick={(r) => { setMaterial(r); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function GoLiveCard({ me, subjects, token, open, setOpen, onRoomsChanged }) {
  return (
    <div className="fd-card fd-golive-card">
      <div className="fd-golive-inner">
        <Avatar user={me} size={42} />
        <div className="fd-golive-text">
          <div className="fd-golive-title">Go live with friends</div>
          <div className="fd-golive-sub">Quiz battle on a material — or a quiet study room.</div>
        </div>
        <button className="fd-go-btn" onClick={() => setOpen(true)}>Go live</button>
      </div>
      {open && (
        <GoLiveSheet token={token} subjects={subjects} onClose={() => setOpen(false)} onRoomsChanged={onRoomsChanged} />
      )}
    </div>
  );
}
