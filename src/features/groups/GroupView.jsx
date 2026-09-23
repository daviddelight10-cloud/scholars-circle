import { useCallback, useEffect, useState } from "react";
import { groupsApi } from "./groupsApi";
import { API_BASE } from "../../lib/constants";
import GroupChat from "../study-group/GroupChat.jsx";
import GroupMembers from "../study-group/GroupMembers.jsx";
import GroupGoals from "../study-group/GroupGoals.jsx";
import GroupLeaderboard from "../study-group/GroupLeaderboard.jsx";
import StudyRooms from "../study-group/StudyRooms.jsx";
import QuizBattles from "../study-group/QuizBattles.jsx";
import GroupStreak from "../study-group/GroupStreak.jsx";

const SUB_TABS = [
  { id: "chat", icon: "💬", label: "Chat" },
  { id: "members", icon: "👥", label: "Members" },
  { id: "board", icon: "🏆", label: "Board" },
  { id: "goals", icon: "🎯", label: "Goals" },
  { id: "rooms", icon: "🚀", label: "Rooms" },
  { id: "battles", icon: "⚔️", label: "Battles" },
  { id: "streak", icon: "🔥", label: "Streak" },
];

// Shared hub for a study group (kind="group" classroom). Also reusable for
// faculty classrooms — invite/management UI hides automatically when the
// classroom has no joinCode.
export function GroupView({ group, token, currentUser, subjects = [], isFaculty = false, onBack, onChanged, onLeft }) {
  const [sub, setSub] = useState("chat");
  const [members, setMembers] = useState([]);
  const [copied, setCopied] = useState(null); // "code" | "link"
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isCreator = !!group?.isCreator;
  const isGroup = group?.kind !== "classroom";
  const canManage = isCreator || isFaculty;

  const fetchMembers = useCallback(() => {
    fetch(`${API_BASE}/study-group/${group.id}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setMembers)
      .catch(() => {});
  }, [group?.id, token]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const copy = async (what) => {
    const link = `${window.location.origin}/?tab=discuss&feedTab=groups&join=${group.joinCode}`;
    const text = what === "link" ? link : group.joinCode;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {}
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await groupsApi.leave({ token, id: group.id });
      onLeft?.(group);
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await groupsApi.remove({ token, id: group.id });
      onLeft?.(group);
    } catch (e) {
      alert(e.message);
      setBusy(false);
    }
  };

  const togglePublic = async () => {
    try {
      const g = await groupsApi.update({ token, id: group.id, isPublic: !group.isPublic });
      onChanged?.(g);
    } catch (e) {
      alert(e.message);
    }
  };

  const rotateCode = async () => {
    try {
      const g = await groupsApi.update({ token, id: group.id, regenerateCode: true });
      onChanged?.(g);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <div className="fd-group">
      <div className="fd-group-head">
        {onBack && <button className="fd-backbtn" onClick={onBack} aria-label="Back to groups">←</button>}
        <div className="fd-group-title">
          <div className="fd-group-name">{group.name}</div>
          <div className="fd-group-meta">
            {[group.subject, `${members.length || group.memberCount || 0} member${(members.length || group.memberCount) === 1 ? "" : "s"}`, group.isPublic ? "Public" : "Private"]
              .filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="fd-action-menu-wrap">
          <button className="fd-icon-btn" onClick={() => setMenuOpen((v) => !v)} title="Group options">⋯</button>
          {menuOpen && (
            <div className="fd-menu">
              {group.joinCode && (
                <>
                  <button onClick={() => { copy("link"); }}>{copied === "link" ? "✓ Copied" : "Copy invite link"}</button>
                  <button onClick={() => { copy("code"); }}>{copied === "code" ? "✓ Copied" : `Copy code (${group.joinCode})`}</button>
                </>
              )}
              {isGroup && isCreator && <button onClick={togglePublic}>{group.isPublic ? "Make private" : "Make public"}</button>}
              {isGroup && isCreator && <button onClick={rotateCode}>New invite code</button>}
              {isGroup && !isCreator && <button className="danger" onClick={leave}>Leave group</button>}
              {isGroup && isCreator && <button className="danger" onClick={() => setConfirmDelete(true)}>Delete group</button>}
            </div>
          )}
        </div>
      </div>

      {group.description && <div className="fd-group-desc">{group.description}</div>}

      {group.joinCode && (
        <button className="fd-invite-strip" onClick={() => copy("link")} title="Copy invite link">
          <span className="fd-invite-code">🔑 {group.joinCode}</span>
          <span className="fd-invite-hint">{copied ? "✓ Copied!" : "Tap to copy invite link"}</span>
        </button>
      )}

      <div className="fd-group-tabs">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            className={`fd-tab ${sub === t.id ? "active" : ""}`}
            onClick={() => setSub(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div key={sub} className="fd-group-body">
        {sub === "chat" && <GroupChat classroomId={group.id} token={token} currentUser={currentUser} />}
        {sub === "members" && <GroupMembers classroomId={group.id} token={token} currentUser={currentUser} />}
        {sub === "board" && <GroupLeaderboard classroomId={group.id} token={token} currentUser={currentUser} />}
        {sub === "goals" && <GroupGoals classroomId={group.id} token={token} isTeacher={canManage} />}
        {sub === "rooms" && <StudyRooms classroomId={group.id} token={token} currentUser={currentUser} />}
        {sub === "battles" && <QuizBattles classroomId={group.id} token={token} currentUser={currentUser} members={members} subjects={subjects} />}
        {sub === "streak" && <GroupStreak classroomId={group.id} token={token} />}
      </div>

      {confirmDelete && (
        <div className="fd-sheet-backdrop" onClick={() => setConfirmDelete(false)}>
          <div className="fd-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fd-sheet-head">
              <b>Delete “{group.name}”?</b>
              <button className="fd-icon-btn" onClick={() => setConfirmDelete(false)}>✕</button>
            </div>
            <div className="fd-sheet-sub">
              This removes the group, its chat, goals and rooms for all {group.memberCount} member{group.memberCount === 1 ? "" : "s"}. This can't be undone.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="fd-follow-btn" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button className="fd-join-btn danger" style={{ flex: 1 }} disabled={busy} onClick={remove}>
                {busy ? "Deleting…" : "Delete group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
