import { useCallback, useEffect, useState } from "react";
import { groupsApi } from "./groupsApi";
import { API_BASE } from "../../lib/constants";
import GroupChat from "../study-group/GroupChat.jsx";
import GroupMembers from "../study-group/GroupMembers.jsx";
import GroupGoals from "../study-group/GroupGoals.jsx";
import GroupPlay from "../study-group/GroupPlay.jsx";
import { FdScreen, FdSheet } from "../feed/feedUi.jsx";

const SUB_TABS = [
  { id: "chat", icon: "💬", label: "Chat" },
  { id: "play", icon: "⚔️", label: "Play" },
  { id: "goals", icon: "🎯", label: "Goals" },
  { id: "members", icon: "👥", label: "Members" },
];

function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

// Deterministic gradient from the group name — every group gets its own hue.
function groupGradient(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 65% 45%), hsl(${(h + 40) % 360} 70% 32%))`;
}

// Shared hub for a study group (kind="group" classroom). Also reusable for
// faculty classrooms — invite/management UI hides automatically when the
// classroom has no joinCode.
export function GroupView({ group, token, currentUser, subjects = [], isFaculty = false, onBack, onChanged, onLeft, onOpenResource, onJoinQuiz, onOpenProfile }) {
  const [sub, setSub] = useState("chat");
  const [members, setMembers] = useState([]);
  const [pulse, setPulse] = useState(null); // { streak, activeNow, liveBattles }
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

  const fetchPulse = useCallback(() => {
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API_BASE}/study-group/${group.id}/streak`, { headers: h }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${API_BASE}/study-group/${group.id}/battles`, { headers: h }).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ])
      .then(([streak, battles]) => {
        setPulse({
          streak: streak?.groupStreak || 0,
          activeNow: streak?.activeNow || 0,
          liveBattles: (battles || []).filter((b) => b.live).length,
        });
      })
      .catch(() => {});
  }, [group?.id, token]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { fetchPulse(); }, [fetchPulse]);

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

  const memberCount = members.length || group.memberCount || 0;

  return (
    <FdScreen
      className="fd-group-screen"
      title={group.name}
      meta={[group.subject, `${memberCount} member${memberCount === 1 ? "" : "s"}`, group.isPublic ? "Public" : "Private"].filter(Boolean).join(" · ")}
      avatar={<span className="gv-avatar" style={{ background: groupGradient(group.name) }}>{initials(group.name)}</span>}
      onBack={onBack}
      onBackLabel="Back to groups"
      actions={
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
      }
    >
      {group.description && <div className="fd-group-desc">{group.description}</div>}

      <div className="fd-group-pulse gv-signal">
        <span className={`gv-signal-chip ${pulse?.streak > 0 ? "hot" : ""}`}>🔥 {pulse?.streak ?? "…"}d streak</span>
        <span className={`gv-signal-chip ${pulse?.activeNow > 0 ? "live" : ""}`}>🟢 {pulse?.activeNow ?? "…"} studying</span>
        <span className={`gv-signal-chip ${pulse?.liveBattles > 0 ? "battle" : ""}`}>⚔️ {pulse?.liveBattles ?? "…"} live</span>
        {group.joinCode && (
          <button className="gv-invite-pill" onClick={() => copy("link")} title="Copy invite link">
            🔑 {group.joinCode} {copied ? "✓" : "⧉"}
          </button>
        )}
      </div>

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
        {sub === "chat" && (
          <GroupChat
            classroomId={group.id}
            token={token}
            currentUser={currentUser}
            onOpenResource={onOpenResource}
            onJoinQuiz={onJoinQuiz}
            onStartBattle={() => setSub("play")}
          />
        )}
        {sub === "play" && (
          <div className="fd-group-scroll">
            <GroupPlay
              classroomId={group.id}
              token={token}
              currentUser={currentUser}
              onJoinQuiz={onJoinQuiz}
            />
          </div>
        )}
        {sub === "goals" && (
          <div className="fd-group-scroll">
            <GroupGoals classroomId={group.id} token={token} isTeacher={canManage} />
          </div>
        )}
        {sub === "members" && (
          <div className="fd-group-scroll">
            <GroupMembers classroomId={group.id} token={token} currentUser={currentUser} members={members} onOpenProfile={onOpenProfile} />
          </div>
        )}
      </div>

      {confirmDelete && (
        <FdSheet title={`Delete “${group.name}”?`} onClose={() => setConfirmDelete(false)}>
          <div className="fd-sheet-sub">
            This removes the group, its chat and goals for all {group.memberCount} member{group.memberCount === 1 ? "" : "s"}. This can't be undone.
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button className="fd-follow-btn" style={{ flex: 1 }} onClick={() => setConfirmDelete(false)}>Cancel</button>
            <button className="fd-join-btn danger" style={{ flex: 1 }} disabled={busy} onClick={remove}>
              {busy ? "Deleting…" : "Delete group"}
            </button>
          </div>
        </FdSheet>
      )}
    </FdScreen>
  );
}
