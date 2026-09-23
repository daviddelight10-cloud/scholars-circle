import { useEffect, useRef, useState } from "react";
import { messagesApi } from "./messagesApi";
import { Avatar } from "../feed/feedUi";

// Sheet for starting a new chat — empty query shows your circle + campus,
// typing searches everyone.
export function PeopleSearchSheet({ token, onPick, onClose }) {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState(null);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    messagesApi
      .searchPeers({ token, q })
      .then((list) => alive && setPeople(list || []))
      .catch(() => alive && setPeople([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [token, q]);

  const onQuery = (v) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQ(v.trim()), 250);
  };

  return (
    <div className="fd-sheet-backdrop" onClick={onClose}>
      <div className="fd-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fd-sheet-head">
          <b>💬 New chat</b>
          <button className="fd-icon-btn" onClick={onClose}>✕</button>
        </div>
        <input
          className="fd-sheet-search"
          placeholder="Search by name or username…"
          onChange={(e) => onQuery(e.target.value)}
          autoFocus
        />
        <div className="fd-sheet-list">
          {loading && <div className="fd-comments-loading">Searching…</div>}
          {!loading && (people || []).length === 0 && (
            <div className="fd-empty-sub" style={{ padding: 16 }}>
              {q ? `Nobody found for “${q}”` : "Follow people or ask classmates to join you on Scholar's Circle."}
            </div>
          )}
          {(people || []).map((u) => (
            <button key={u.id} className="fd-sheet-item" onClick={() => onPick(u)}>
              <Avatar user={u} size={38} />
              <span className="fd-sheet-item-info">
                <span className="fd-sheet-item-title">
                  {u.name}
                  {u.isFollowing ? <span className="fd-mini-chip">following</span> : null}
                </span>
                <span className="fd-sheet-item-meta">
                  {[u.handle, u.uni || (u.xp ? `${u.xp} XP` : null)].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span className="fd-link">Chat</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
