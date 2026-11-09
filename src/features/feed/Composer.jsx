import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { feedApi } from "./feedApi";
import { createLiveRoom, mcqVariant, mcqQuestionCount } from "../live-quiz/liveQuizApi.js";
import { Avatar, displayTitle, FdSheet } from "./feedUi";

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

  const canPost = !!(text.trim() || attached);

  return (
    <div className="fd-composer">
      <div className="fd-composer-row">
        <Avatar user={me} size={40} />
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder={asQuestion ? "What do you want to ask?" : "Share a resource or ask a question…"}
          aria-label="Write a post"
        />
        {canPost && (
          <button className="fd-share" disabled={busy} onClick={submit}>
            {busy ? "…" : "Share"}
          </button>
        )}
      </div>

      {attached && (
        <div className="fd-attached">
          <span className="fd-attached-icon">📄</span>
          <span className="fd-attached-title">{displayTitle(attached.title)}</span>
          <button className="fd-attached-x" onClick={() => setAttached(null)}>✕</button>
        </div>
      )}

      <div className="fd-acts">
        <button
          className={`fd-act ${attached ? "active" : ""}`}
          aria-pressed={!!attached}
          onClick={() => setAttachOpen(true)}
        >
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h6" /></svg>
          Resource
        </button>
        <button
          className={`fd-act ${asQuestion ? "active" : ""}`}
          aria-pressed={asQuestion}
          onClick={() => setAsQuestion((v) => !v)}
        >
          <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" /></svg>
          Ask
        </button>
        <button className="fd-act live" onClick={() => setLiveOpen(true)}>
          <span className="fd-dot" />
          Go live
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
    <FdSheet
      title={mcqOnly ? "Pick a quiz material" : "Pick a material"}
      onClose={onClose}
      className="fd-picker"
    >
      <div className="fd-picker-head">
        <input
          className="fd-sheet-search"
          placeholder="Search your library…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>
      <div className="fd-sheet-list">
        {loading && <div className="fd-comments-loading">Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div className="fd-empty-sub" style={{ padding: 16 }}>
            {mcqOnly
              ? "No Rapid Recall sets found — generate one on a material in My Space first."
              : "No materials yet — upload or save resources in My Space first."}
          </div>
        )}
        {filtered.map((r) => (
          <button key={r.id} className="fd-sheet-item" onClick={() => onPick(r)}>
            <span className="fd-attached-icon">{mcqOnly ? "⚡" : "📄"}</span>
            <span className="fd-sheet-item-info">
              <span className="fd-sheet-item-title">{displayTitle(r.title)}</span>
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
    </FdSheet>
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
      navigate(`/live/${res.code}`, { state: { ticket: res.ticket, roomId: res.roomId, returnTo: window.location.pathname } });
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
    <>
      <FdSheet
        title={mode === "quiz" ? "⚡ Go live — live quiz" : "🟢 Quiet study room"}
        onClose={onClose}
        footer={mode === "quiz" ? (
          <button className="fd-go-btn" style={{ width: "100%", padding: 12, fontSize: 14 }} disabled={!mcq || busy} onClick={goQuiz}>
            {busy ? "Opening lobby…" : mcq ? `Go live — ${qCount} questions` : "Pick a material to go live"}
          </button>
        ) : (
          <button className="fd-go-btn" style={{ width: "100%", padding: 12, fontSize: 14 }} disabled={busy} onClick={createQuiet}>
            {busy ? "Opening…" : "Open the room"}
          </button>
        )}
      >
        <div className="fd-mode-tabs">
          <button
            className={`fd-mode-tab ${mode === "quiz" ? "active" : ""}`}
            onClick={() => setMode("quiz")}
          >
            ⚡ Live quiz
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
              Pick a material with a Rapid Recall set — your circle joins and everyone answers the same questions live.
            </div>
            <label className="fd-label">Quiz material</label>
            {material ? (
              <div className="fd-attached" style={{ margin: "0 0 10px" }}>
                <span className="fd-attached-icon">⚡</span>
                <span className="fd-attached-title">
                  {displayTitle(material.title)} · {qCount} question{qCount === 1 ? "" : "s"}
                </span>
                <button className="fd-attached-x" onClick={() => setMaterial(null)}>✕</button>
              </div>
            ) : (
              <button className="fd-pill" style={{ marginBottom: 10 }} onClick={() => setPickerOpen(true)}>
                ⚡ Pick from your library
              </button>
            )}
            <div className="fd-sheet-sub" style={{ marginTop: 8 }}>
              Up to 50 friends can join your lobby.
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
                <span className="fd-attached-title">{displayTitle(material.title)}</span>
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
          </>
        )}
      </FdSheet>
      {pickerOpen && (
        <MaterialPicker
          token={token}
          mcqOnly={mode === "quiz"}
          onPick={(r) => { setMaterial(r); setPickerOpen(false); }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}

function GoLiveCard({ me, subjects, token, open, setOpen, onRoomsChanged }) {
  return (
    <div className="fd-card fd-golive-card">
      <div className="fd-golive-inner">
        <Avatar user={me} size={42} />
        <div className="fd-golive-text">
          <div className="fd-golive-title">Go live with friends</div>
          <div className="fd-golive-sub">Live quiz on a material — or a quiet study room.</div>
        </div>
        <button className="fd-go-btn" onClick={() => setOpen(true)}>Go live</button>
      </div>
      {open && (
        <GoLiveSheet token={token} subjects={subjects} onClose={() => setOpen(false)} onRoomsChanged={onRoomsChanged} />
      )}
    </div>
  );
}
