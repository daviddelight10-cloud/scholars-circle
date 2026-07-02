import React, { useState, useEffect } from "react";

export function DiscussionBoard({ subjects, discussion, setDiscussion, username, isTeacher }) {
  const [activeSubject, setActiveSubject] = useState(subjects[0]?.id || "");
  const [text, setText] = useState("");
  const threads = discussion[activeSubject] || [];

  useEffect(() => {
    if (!activeSubject && subjects[0]?.id) setActiveSubject(subjects[0].id);
  }, [subjects, activeSubject]);

  function post() {
    if (!text.trim()) return;
    const msg = { id: Date.now(), author: username, role: isTeacher ? "Teacher" : "Student", text: text.trim(), ts: Date.now(), replies: [] };
    setDiscussion(prev => ({ ...prev, [activeSubject]: [msg, ...(prev[activeSubject] || [])] }));
    setText("");
  }

  function reply(threadId, replyText) {
    if (!replyText.trim()) return;
    setDiscussion(prev => ({
      ...prev,
      [activeSubject]: (prev[activeSubject] || []).map(t =>
        t.id === threadId ? { ...t, replies: [...t.replies, { id: Date.now(), author: username, role: isTeacher ? "Teacher" : "Student", text: replyText, ts: Date.now() }] } : t
      )
    }));
  }

  return (
    <div className="card">
      <h2>Discussion Board</h2>
      <p className="muted">Ask questions, share insights per subject. Stored locally.</p>
      <div className="row" style={{ flexWrap: "wrap" }}>
        {subjects.map(s => (
          <button key={s.id} onClick={() => setActiveSubject(s.id)}
            style={{ borderColor: activeSubject === s.id ? "#FFD700" : undefined, color: activeSubject === s.id ? "#FFD700" : undefined }}>
            {s.icon} {s.label} {(discussion[s.id] || []).length > 0 ? `(${(discussion[s.id] || []).length})` : ""}
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12, alignItems: "flex-start" }}>
        <textarea rows={3} style={{ flex: 1, resize: "vertical" }} value={text}
          onChange={e => setText(e.target.value)} placeholder="Ask a question or share a tip…" />
        <button style={{ borderColor: "#FFD700", color: "#FFD700", alignSelf: "flex-end" }} onClick={post}>Post</button>
      </div>
      {threads.length === 0 && <p className="muted">No posts yet. Be the first to ask a question!</p>}
      {threads.map(t => (
        <DiscussionThread key={t.id} thread={t} onReply={(rt) => reply(t.id, rt)} username={username} isTeacher={isTeacher} />
      ))}
    </div>
  );
}

function DiscussionThread({ thread, onReply, username, isTeacher }) {
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);

  return (
    <div className="discussion-thread">
      <div className="discussion-post">
        <span className="post-author">{thread.author} <span className="muted" style={{ fontSize: 11 }}>({thread.role}) · {new Date(thread.ts).toLocaleString()}</span></span>
        <p style={{ margin: "4px 0" }}>{thread.text}</p>
        <button style={{ fontSize: 12 }} onClick={() => setShowReply(v => !v)}>↩ Reply ({thread.replies.length})</button>
      </div>
      {thread.replies.map(r => (
        <div key={r.id} className="discussion-reply">
          <span className="post-author" style={{ color: isTeacher || r.role === "Teacher" ? "#facc15" : "#FFD700" }}>
            {r.author} <span className="muted" style={{ fontSize: 11 }}>({r.role}) · {new Date(r.ts).toLocaleString()}</span>
          </span>
          <p style={{ margin: "2px 0" }}>{r.text}</p>
        </div>
      ))}
      {showReply && (
        <div className="row" style={{ marginTop: 4, paddingLeft: 16 }}>
          <input style={{ flex: 1 }} value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write a reply…" />
          <button style={{ borderColor: "#FFD700", color: "#FFD700" }} onClick={() => { onReply(replyText); setReplyText(""); setShowReply(false); }}>Send</button>
        </div>
      )}
    </div>
  );
}
