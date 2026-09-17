import { useEffect, useRef, useState } from "react";
import { feedApi } from "./feedApi";
import { Avatar } from "./feedUi";

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

// Library picker — your uploads + saved/bookmarked materials, deduped
export function MaterialPicker({ token, cache, setCache, onPick, onClose }) {
  const [loading, setLoading] = useState(!cache?.length);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      feedApi.getMyResources({ token }).catch(() => []),
      feedApi.getMyBookmarks({ token }).catch(() => []),
    ])
      .then(([uploads, bookmarks]) => {
        if (!alive) return;
        const seen = new Set();
        const merged = [];
        for (const r of [...(uploads || []), ...(bookmarks || [])]) {
          if (r?.id && !seen.has(r.id)) {
            seen.add(r.id);
            merged.push(r);
          }
        }
        setCache?.(merged);
        setLoading(false);
      });
    return () => { alive = false; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const resources = cache || [];

  const filtered = resources.filter((r) =>
    !q || r.title?.toLowerCase().includes(q.toLowerCase()) || r.subject?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="fd-sheet-backdrop" onClick={onClose}>
      <div className="fd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fd-sheet-head">
          <b>Pick a material</b>
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
              No materials yet — upload or save resources in My Space first.
            </div>
          )}
          {filtered.slice(0, 30).map((r) => (
            <button key={r.id} className="fd-sheet-item" onClick={() => onPick(r)}>
              <span className="fd-attached-icon">📄</span>
              <span className="fd-sheet-item-info">
                <span className="fd-sheet-item-title">{r.title}</span>
                <span className="fd-sheet-item-meta">{r.subject} · {r.contentType}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GoLiveSheet({ token, subjects, onClose, onRoomsChanged }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [material, setMaterial] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [seats, setSeats] = useState(8);
  const [busy, setBusy] = useState(false);

  const create = async () => {
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
          <b>🟢 Go live with friends</b>
          <button className="fd-icon-btn" onClick={onClose}>✕</button>
        </div>
        <div className="fd-sheet-sub">Open a study room — anyone in your circle can pull up a seat.</div>
        <label className="fd-label">Room name</label>
        <input
          className="fd-sheet-input"
          placeholder="e.g. Anatomy cram before the test"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
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
        <button className="fd-go-btn" disabled={busy} onClick={create}>
          {busy ? "Opening…" : "Open the room"}
        </button>
      </div>
      {pickerOpen && (
        <MaterialPicker
          token={token}
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
          <div className="fd-golive-sub">Host a study room — your circle gets to pull up a seat.</div>
        </div>
        <button className="fd-go-btn" onClick={() => setOpen(true)}>Go live</button>
      </div>
      {open && (
        <GoLiveSheet token={token} subjects={subjects} onClose={() => setOpen(false)} onRoomsChanged={onRoomsChanged} />
      )}
    </div>
  );
}
