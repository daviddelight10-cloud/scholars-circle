import { useState, useEffect } from "react";

const STUDY_GROUPS_KEY = "sc_study_groups_v1";
const GROUP_MEMBERS_KEY = "sc_group_members_v1";
const GROUP_CHAT_KEY = "sc_group_chat_v1";
const GROUP_RESOURCES_KEY = "sc_group_resources_v1";
const GROUP_ANNOUNCEMENTS_KEY = "sc_group_announcements_v1";
const GROUP_ACTIVITY_KEY = "sc_group_activity_v1";
const GROUP_CHALLENGES_KEY = "sc_group_challenges_v1";
const GROUP_SESSIONS_KEY = "sc_group_sessions_v1";
const GROUP_QUIZ_STATE_KEY = "sc_group_quiz_v1";

function loadStudyGroups() {
  try {
    const raw = localStorage.getItem(STUDY_GROUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStudyGroups(groups) {
  localStorage.setItem(STUDY_GROUPS_KEY, JSON.stringify(groups));
}

function loadGroupMembers() {
  try {
    const raw = localStorage.getItem(GROUP_MEMBERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveGroupMembers(members) {
  localStorage.setItem(GROUP_MEMBERS_KEY, JSON.stringify(members));
}

function loadGroupChat() {
  try { const raw = localStorage.getItem(GROUP_CHAT_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveGroupChat(data) { localStorage.setItem(GROUP_CHAT_KEY, JSON.stringify(data)); }

function loadGroupResources() {
  try { const raw = localStorage.getItem(GROUP_RESOURCES_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveGroupResources(data) { localStorage.setItem(GROUP_RESOURCES_KEY, JSON.stringify(data)); }

function loadGroupAnnouncements() {
  try { const raw = localStorage.getItem(GROUP_ANNOUNCEMENTS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveGroupAnnouncements(data) { localStorage.setItem(GROUP_ANNOUNCEMENTS_KEY, JSON.stringify(data)); }

function loadGroupActivity() {
  try { const raw = localStorage.getItem(GROUP_ACTIVITY_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveGroupActivity(data) { localStorage.setItem(GROUP_ACTIVITY_KEY, JSON.stringify(data)); }

function loadGroupChallenges() {
  try { const raw = localStorage.getItem(GROUP_CHALLENGES_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveGroupChallenges(data) { localStorage.setItem(GROUP_CHALLENGES_KEY, JSON.stringify(data)); }

function loadGroupSessions() {
  try { const raw = localStorage.getItem(GROUP_SESSIONS_KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function saveGroupSessions(data) { localStorage.setItem(GROUP_SESSIONS_KEY, JSON.stringify(data)); }

function loadGroupQuizState() {
  try { const raw = localStorage.getItem(GROUP_QUIZ_STATE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveGroupQuizState(data) { localStorage.setItem(GROUP_QUIZ_STATE_KEY, JSON.stringify(data)); }

export function StudyGroups({ stats, username, subjects = [] }) {
  // Early return if critical props are missing
  if (!stats) {
    console.error("StudyGroups: stats prop is missing");
    return <div className="card">Loading stats...</div>;
  }

  const [studyGroups, setStudyGroups] = useState(loadStudyGroups());
  const [groupMembers, setGroupMembers] = useState(loadGroupMembers());
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupSubject, setNewGroupSubject] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState("");

  // New feature states
  const [groupChat, setGroupChat] = useState(loadGroupChat());
  const [groupResources, setGroupResources] = useState(loadGroupResources());
  const [groupAnnouncements, setGroupAnnouncements] = useState(loadGroupAnnouncements());
  const [groupActivity, setGroupActivity] = useState(loadGroupActivity());
  const [groupChallenges, setGroupChallenges] = useState(loadGroupChallenges());
  const [groupSessions, setGroupSessions] = useState(loadGroupSessions());
  const [activeTab, setActiveTab] = useState("chat");
  const [chatInput, setChatInput] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceUrl, setResourceUrl] = useState("");
  const [announcementText, setAnnouncementText] = useState("");
  const [challengeTitle, setChallengeTitle] = useState("");
  const [challengeTarget, setChallengeTarget] = useState(50);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionTime, setSessionTime] = useState("");
  const [quizMode, setQuizMode] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizAnswer, setQuizAnswer] = useState(0);
  const [liveQuiz, setLiveQuiz] = useState(null);

  // Reload data when username changes
  useEffect(() => {
    setStudyGroups(loadStudyGroups());
    setGroupMembers(loadGroupMembers());
    setGroupChat(loadGroupChat());
    setGroupResources(loadGroupResources());
    setGroupAnnouncements(loadGroupAnnouncements());
    setGroupActivity(loadGroupActivity());
    setGroupChallenges(loadGroupChallenges());
    setGroupSessions(loadGroupSessions());
  }, [username]);

  // Auto-fill join code from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    if (code) {
      setJoinCode(code.toUpperCase());
    }
  }, []);

  // Generate a random join code
  function generateJoinCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  function createGroup() {
    try {
      if (!newGroupName.trim()) return;
      
      console.log("Creating group for user:", username);
      console.log("Stats:", stats);
      
      const joinCode = generateJoinCode();
      const newGroup = {
        id: `group_${Date.now()}`,
        name: newGroupName,
        subject: newGroupSubject || null,
        joinCode,
        createdBy: username || "Student",
        createdAt: Date.now(),
        memberCount: 1,
        totalXP: (stats && stats.xp) || 0,
        totalSessions: (stats && stats.sessions) || 0
      };
      
      console.log("New group object:", newGroup);
      
      // Update groups state first
      const updatedGroups = [...studyGroups, newGroup];
      setStudyGroups(updatedGroups);
      
      // Save to localStorage with error handling
      try {
        saveStudyGroups(updatedGroups);
        console.log("Groups saved to localStorage");
      } catch (storageError) {
        console.error("Failed to save groups to localStorage:", storageError);
        setError("Storage error. Please clear browser data and try again.");
        return;
      }
      
      // Add creator as member
      const updatedMembers = {
        ...groupMembers,
        [newGroup.id]: [{
          username: username || "Student",
          xp: (stats && stats.xp) || 0,
          sessions: (stats && stats.sessions) || 0,
          joinedAt: Date.now(),
          isCreator: true
        }]
      };
      
      console.log("Updated members:", updatedMembers);
      
      setGroupMembers(updatedMembers);
      
      try {
        saveGroupMembers(updatedMembers);
        console.log("Members saved to localStorage");
      } catch (storageError) {
        console.error("Failed to save members to localStorage:", storageError);
        setError("Storage error. Please clear browser data and try again.");
        return;
      }
      
      console.log("Group created successfully:", newGroup);
      
      // Log activity
      logActivity(newGroup.id, "group_created", `${username || "Student"} created the group`);

      // Update UI state last
      setNewGroupName("");
      setNewGroupSubject("");
      setShowCreateModal(false);
      setSelectedGroup(newGroup);
      setError("");
    } catch (e) {
      console.error("Error creating group:", e);
      setError("Failed to create group: " + (e.message || "Unknown error"));
    }
  }

  function joinGroup() {
    if (!joinCode.trim()) return;
    
    console.log("Attempting to join group with code:", joinCode);
    console.log("Available groups:", studyGroups);
    
    const group = studyGroups.find(g => g.joinCode === joinCode);
    if (!group) {
      setError("Invalid join code. Please check the code and try again.");
      return;
    }
    
    console.log("Found group:", group);
    
    const existingMembers = groupMembers[group.id] || [];
    if (existingMembers.some(m => m.username === username)) {
      setError("You're already in this group.");
      return;
    }
    
    const updatedMembers = {
      ...groupMembers,
      [group.id]: [...existingMembers, {
        username,
        xp: stats?.xp || 0,
        sessions: stats?.sessions || 0,
        joinedAt: Date.now(),
        isCreator: false
      }]
    };
    setGroupMembers(updatedMembers);
    saveGroupMembers(updatedMembers);
    
    // Update group member count
    const updatedGroups = studyGroups.map(g => 
      g.id === group.id 
        ? { ...g, memberCount: g.memberCount + 1, totalXP: g.totalXP + (stats?.xp || 0) }
        : g
    );
    setStudyGroups(updatedGroups);
    saveStudyGroups(updatedGroups);
    
    console.log("Joined group successfully");
    
    logActivity(group.id, "member_joined", `${username || "Student"} joined the group`);

    setJoinCode("");
    setSelectedGroup(group);
    setError("");
  }

  function leaveGroup(groupId) {
    const group = studyGroups.find(g => g.id === groupId);
    const memberLeaving = groupMembers[groupId]?.find(m => m.username === username);
    
    // Update group member count and total XP
    const updatedGroups = studyGroups.map(g => 
      g.id === groupId 
        ? { ...g, memberCount: Math.max(0, g.memberCount - 1), totalXP: Math.max(0, g.totalXP - (memberLeaving?.xp || 0)) }
        : g
    );
    setStudyGroups(updatedGroups);
    saveStudyGroups(updatedGroups);
    
    // Remove member from group
    const updatedMembers = { ...groupMembers };
    const groupMembersList = updatedMembers[groupId]?.filter(m => m.username !== username) || [];
    if (groupMembersList.length === 0) {
      delete updatedMembers[groupId];
    } else {
      updatedMembers[groupId] = groupMembersList;
    }
    setGroupMembers(updatedMembers);
    saveGroupMembers(updatedMembers);
    
    if (selectedGroup?.id === groupId) {
      setSelectedGroup(null);
    }
  }

  function deleteGroup(groupId) {
    const updated = studyGroups.filter(g => g.id !== groupId);
    setStudyGroups(updated);
    saveStudyGroups(updated);

    const updatedMembers = { ...groupMembers };
    delete updatedMembers[groupId];
    setGroupMembers(updatedMembers);
    saveGroupMembers(updatedMembers);

    // Clean up all group data
    const cleanChat = { ...groupChat }; delete cleanChat[groupId]; setGroupChat(cleanChat); saveGroupChat(cleanChat);
    const cleanResources = { ...groupResources }; delete cleanResources[groupId]; setGroupResources(cleanResources); saveGroupResources(cleanResources);
    const cleanAnnouncements = { ...groupAnnouncements }; delete cleanAnnouncements[groupId]; setGroupAnnouncements(cleanAnnouncements); saveGroupAnnouncements(cleanAnnouncements);
    const cleanActivity = { ...groupActivity }; delete cleanActivity[groupId]; setGroupActivity(cleanActivity); saveGroupActivity(cleanActivity);
    const cleanChallenges = { ...groupChallenges }; delete cleanChallenges[groupId]; setGroupChallenges(cleanChallenges); saveGroupChallenges(cleanChallenges);
    const cleanSessions = { ...groupSessions }; delete cleanSessions[groupId]; setGroupSessions(cleanSessions); saveGroupSessions(cleanSessions);

    if (selectedGroup?.id === groupId) {
      setSelectedGroup(null);
    }
  }

  // ===== ACTIVITY LOG =====
  function logActivity(groupId, type, text) {
    const entry = { type, text, timestamp: Date.now(), username: username || "Student" };
    const updated = { ...groupActivity, [groupId]: [entry, ...(groupActivity[groupId] || [])].slice(0, 50) };
    setGroupActivity(updated);
    saveGroupActivity(updated);
  }

  // ===== MODERATOR ROLE =====
  function isModerator(groupId, user) {
    const members = groupMembers[groupId] || [];
    const member = members.find(m => m.username === user);
    return member?.isCreator || member?.isModerator || false;
  }

  function isCreator(groupId, user) {
    const members = groupMembers[groupId] || [];
    return members.some(m => m.username === user && m.isCreator);
  }

  function promoteMember(groupId, memberName) {
    if (!isCreator(groupId, username)) return;
    const updated = { ...groupMembers };
    updated[groupId] = (updated[groupId] || []).map(m =>
      m.username === memberName ? { ...m, isModerator: true } : m
    );
    setGroupMembers(updated);
    saveGroupMembers(updated);
    logActivity(groupId, "moderator", `${memberName} was promoted to moderator`);
  }

  function kickMember(groupId, memberName) {
    if (!isModerator(groupId, username)) return;
    if (memberName === username) return;
    const group = studyGroups.find(g => g.id === groupId);
    const memberLeaving = groupMembers[groupId]?.find(m => m.username === memberName);

    const updatedGroups = studyGroups.map(g =>
      g.id === groupId
        ? { ...g, memberCount: Math.max(0, g.memberCount - 1), totalXP: Math.max(0, g.totalXP - (memberLeaving?.xp || 0)) }
        : g
    );
    setStudyGroups(updatedGroups);
    saveStudyGroups(updatedGroups);

    const updatedMembers = { ...groupMembers };
    updatedMembers[groupId] = (updatedMembers[groupId] || []).filter(m => m.username !== memberName);
    if (updatedMembers[groupId]?.length === 0) delete updatedMembers[groupId];
    setGroupMembers(updatedMembers);
    saveGroupMembers(updatedMembers);
    logActivity(groupId, "member_left", `${memberName} was removed from the group`);
  }

  // ===== GROUP CHAT =====
  function sendChat(groupId, text) {
    if (!text.trim()) return;
    const entry = { id: Date.now(), username: username || "Student", text: text.trim(), timestamp: Date.now() };
    const updated = { ...groupChat, [groupId]: [...(groupChat[groupId] || []), entry].slice(-100) };
    setGroupChat(updated);
    saveGroupChat(updated);
    setChatInput("");
  }

  // ===== SHARED RESOURCES =====
  function addResource(groupId, title, url) {
    if (!title.trim()) return;
    const entry = { id: Date.now(), title: title.trim(), url: url.trim(), addedBy: username || "Student", timestamp: Date.now() };
    const updated = { ...groupResources, [groupId]: [...(groupResources[groupId] || []), entry].slice(-50) };
    setGroupResources(updated);
    saveGroupResources(updated);
    setResourceTitle("");
    setResourceUrl("");
    logActivity(groupId, "resource", `${username || "Student"} shared a resource: ${title}`);
  }

  // ===== ANNOUNCEMENTS =====
  function setAnnouncement(groupId, text) {
    if (!text.trim()) return;
    const updated = { ...groupAnnouncements, [groupId]: { text: text.trim(), updatedBy: username || "Student", updatedAt: Date.now() } };
    setGroupAnnouncements(updated);
    saveGroupAnnouncements(updated);
    setAnnouncementText("");
    logActivity(groupId, "announcement", `${username || "Student"} updated the announcement`);
  }

  // ===== CHALLENGES =====
  function createChallenge(groupId, title, target) {
    if (!title.trim() || target < 1) return;
    const updated = { ...groupChallenges, [groupId]: { title: title.trim(), target, current: 0, createdBy: username || "Student", createdAt: Date.now() } };
    setGroupChallenges(updated);
    saveGroupChallenges(updated);
    setChallengeTitle("");
    setChallengeTarget(50);
    logActivity(groupId, "challenge", `New challenge: ${title} (target: ${target})`);
  }

  function incrementChallenge(groupId) {
    const challenge = groupChallenges[groupId];
    if (!challenge) return;
    const updated = { ...groupChallenges, [groupId]: { ...challenge, current: Math.min(challenge.current + 1, challenge.target) } };
    setGroupChallenges(updated);
    saveGroupChallenges(updated);
    if (updated[groupId].current >= updated[groupId].target) {
      logActivity(groupId, "challenge", `Challenge completed: ${challenge.title}!`);
    }
  }

  // ===== STUDY SESSIONS =====
  function scheduleSession(groupId, title, timeStr) {
    if (!title.trim() || !timeStr) return;
    const entry = { id: Date.now(), title: title.trim(), scheduledAt: new Date(timeStr).toISOString(), createdBy: username || "Student", joinedBy: [] };
    const updated = { ...groupSessions, [groupId]: [...(groupSessions[groupId] || []), entry].slice(-20) };
    setGroupSessions(updated);
    saveGroupSessions(updated);
    setSessionTitle("");
    setSessionTime("");
    logActivity(groupId, "session", `${username || "Student"} scheduled: ${title}`);
  }

  function joinSession(groupId, sessionId) {
    const updated = { ...groupSessions };
    updated[groupId] = (updated[groupId] || []).map(s =>
      s.id === sessionId ? { ...s, joinedBy: [...new Set([...(s.joinedBy || []), username || "Student"])] } : s
    );
    setGroupSessions(updated);
    saveGroupSessions(updated);
  }

  // ===== LIVE QUIZ =====
  function startLiveQuiz(groupId, question, options, answerIndex) {
    if (!question.trim() || options.some(o => !o.trim())) return;
    const quiz = { id: Date.now(), groupId, question, options, answer: answerIndex, createdBy: username || "Student", responses: {} };
    setLiveQuiz(quiz);
    saveGroupQuizState(quiz);
    setQuizQuestion("");
    setQuizOptions(["", "", "", ""]);
    setQuizAnswer(0);
    setQuizMode(false);
    logActivity(groupId, "quiz", `${username || "Student"} started a live quiz!`);
  }

  function answerLiveQuiz(optionIndex) {
    if (!liveQuiz) return;
    const updated = { ...liveQuiz, responses: { ...liveQuiz.responses, [username || "Student"]: optionIndex } };
    setLiveQuiz(updated);
    saveGroupQuizState(updated);
  }

  function endLiveQuiz() {
    if (!liveQuiz) return;
    const responses = Object.entries(liveQuiz.responses || {});
    const correctCount = responses.filter(([_, ans]) => ans === liveQuiz.answer).length;
    const totalCount = responses.length;
    logActivity(liveQuiz.groupId, "quiz", `Quiz ended: ${correctCount}/${totalCount} correct`);
    setLiveQuiz(null);
    saveGroupQuizState(null);
  }

  const userGroups = studyGroups.filter(g =>
    groupMembers[g.id]?.some(m => m.username === (username || "Student"))
  );

  const selectedGroupMembers = selectedGroup ? (groupMembers[selectedGroup.id] || []) : [];

  // Sort members by XP
  const sortedMembers = selectedGroupMembers && selectedGroupMembers.length > 0 
    ? [...selectedGroupMembers].sort((a, b) => (b.xp || 0) - (a.xp || 0))
    : [];

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2>👥 Study Groups</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            background: "#FFD700",
            color: "white",
            border: "none",
            padding: "8px 16px",
            borderRadius: 6,
            cursor: "pointer"
          }}
        >
          + Create Group
        </button>
      </div>

      {!selectedGroup ? (
        <>
          <p className="muted">
            Create or join study groups to compete with classmates and track collective progress.
          </p>

          {/* Join Group Input */}
          <div style={{ marginBottom: 24, padding: 16, background: "#1f2937", borderRadius: 8 }}>
            <label style={{ display: "block", marginBottom: 8, fontSize: 13 }}>Join with Code</label>
            <div className="row" style={{ gap: 8 }}>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value.toUpperCase());
                  setError("");
                }}
                placeholder="Enter 6-character code"
                maxLength={6}
                style={{
                  flex: 1,
                  padding: 8,
                  background: "#374151",
                  border: error ? "1px solid #ef4444" : "1px solid #4b5563",
                  borderRadius: 4,
                  color: "white",
                  textTransform: "uppercase"
                }}
              />
              <button
                onClick={joinGroup}
                disabled={!joinCode.trim()}
                style={{
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 4,
                  cursor: joinCode.trim() ? "pointer" : "not-allowed",
                  opacity: joinCode.trim() ? 1 : 0.5
                }}
              >
                Join
              </button>
            </div>
            {error && (
              <p style={{ color: "#ef4444", fontSize: 12, marginTop: 8 }}>
                {error}
              </p>
            )}
          </div>

          {/* Your Groups */}
          <h3 style={{ marginBottom: 12 }}>Your Groups ({userGroups.length})</h3>
          {userGroups.length === 0 ? (
            <p className="muted">You haven't joined any groups yet. Create one or ask a friend for their join code!</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {userGroups.map((group) => {
                const isCreator = group.createdBy === (username || "Student");
                const members = groupMembers[group.id] || [];
                const userMember = members.find(m => m.username === (username || "Student"));
                
                return (
                  <div
                    key={group.id}
                    className="lesson-block"
                    style={{
                      borderLeft: "4px solid #FFD700",
                      cursor: "pointer"
                    }}
                    onClick={() => setSelectedGroup(group)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h4 style={{ margin: 0, marginBottom: 4 }}>{group.name}</h4>
                        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                          {isCreator ? "👑 Creator" : "👤 Member"} · Code: <strong>{group.joinCode}</strong>
                        </p>
                      </div>
                      <span style={{ fontSize: 24 }}>👥</span>
                    </div>
                    <div style={{ marginTop: 8, display: "flex", gap: 16, fontSize: 12, color: "#9ca3af" }}>
                      <span>👥 {group.memberCount} member(s)</span>
                      <span>⭐ {group.totalXP} total XP</span>
                      <span>📚 {group.totalSessions} sessions</span>
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12 }}>
                      <span style={{ color: "#10b981" }}>Your XP: {userMember?.xp || 0}</span>
                      <span style={{ marginLeft: 16, color: "#fbbf24" }}>Rank: #{sortedMembers.findIndex(m => m.username === (username || "Student")) + 1}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          <button
            onClick={() => { setSelectedGroup(null); setActiveTab("chat"); setQuizMode(false); setLiveQuiz(null); }}
            style={{
              background: "#374151",
              color: "white",
              border: "none",
              padding: "8px 16px",
              borderRadius: 6,
              cursor: "pointer",
              marginBottom: 16
            }}
          >
            ← Back to Groups
          </button>

          {/* ===== GROUP HEADER ===== */}
          <div style={{
            padding: 20,
            background: "linear-gradient(135deg, #1e3a5f 0%, #1f2937 100%)",
            borderRadius: 12,
            marginBottom: 12,
            border: "1px solid #FFD700"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 style={{ margin: 0, marginBottom: 4 }}>{selectedGroup.name}</h2>
                <p className="muted" style={{ margin: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  Code: <strong style={{ color: "#fbbf24", fontSize: 16 }}>{selectedGroup.joinCode}</strong>
                  <button
                    onClick={() => { navigator.clipboard?.writeText(selectedGroup.joinCode).then(() => alert("Copied!")); }}
                    style={{ background: "#374151", color: "#FFD700", border: "1px solid #4b5563", padding: "2px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                  >
                    📋 Copy
                  </button>
                  <button
                    onClick={() => { const link = `${window.location.origin}${window.location.pathname}?join=${selectedGroup.joinCode}`; navigator.clipboard?.writeText(link).then(() => alert("Invite link copied!")); }}
                    style={{ background: "#374151", color: "#FFD700", border: "1px solid #4b5563", padding: "2px 8px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}
                  >
                    🔗 Link
                  </button>
                  {selectedGroup.subject && (
                    <span style={{ background: "#064e3b", color: "#6ee7b7", padding: "2px 8px", borderRadius: 12, fontSize: 11 }}>
                      {subjects.find(s => s.id === selectedGroup.subject)?.icon} {subjects.find(s => s.id === selectedGroup.subject)?.label || selectedGroup.subject}
                    </span>
                  )}
                </p>
              </div>
              {selectedGroup.createdBy === username ? (
                <button
                  onClick={() => { if (confirm("Delete this group? This cannot be undone.")) deleteGroup(selectedGroup.id); }}
                  style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  Delete Group
                </button>
              ) : (
                <button
                  onClick={() => { if (confirm("Leave this group?")) leaveGroup(selectedGroup.id); }}
                  style={{ background: "#f59e0b", color: "white", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                >
                  Leave Group
                </button>
              )}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 24, fontSize: 14, flexWrap: "wrap" }}>
              <span>👥 {selectedGroup.memberCount} members</span>
              <span>⭐ {selectedGroup.totalXP} total XP</span>
              <span>📚 {selectedGroup.totalSessions} sessions</span>
            </div>
          </div>

          {/* ===== ANNOUNCEMENT BANNER ===== */}
          {groupAnnouncements[selectedGroup.id] && (
            <div style={{ padding: 12, background: "#713f12", borderRadius: 8, marginBottom: 12, border: "1px solid #fbbf24" }}>
              <p style={{ margin: 0, fontSize: 13, color: "#fef3c7" }}>
                📌 <strong>{groupAnnouncements[selectedGroup.id].text}</strong>
                <span style={{ fontSize: 11, color: "#d4d4d8", marginLeft: 8 }}>
                  — {groupAnnouncements[selectedGroup.id].updatedBy}, {new Date(groupAnnouncements[selectedGroup.id].updatedAt).toLocaleDateString()}
                </span>
              </p>
              {isModerator(selectedGroup.id, username) && (
                <div className="row" style={{ gap: 8, marginTop: 8 }}>
                  <input
                    value={announcementText}
                    onChange={(e) => setAnnouncementText(e.target.value)}
                    placeholder="Update announcement..."
                    style={{ flex: 1, padding: 6, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 12 }}
                  />
                  <button onClick={() => setAnnouncement(selectedGroup.id, announcementText)} style={{ background: "#fbbf24", color: "#713f12", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                    Update
                  </button>
                </div>
              )}
            </div>
          )}
          {!groupAnnouncements[selectedGroup.id] && isModerator(selectedGroup.id, username) && (
            <div style={{ padding: 12, background: "#1f2937", borderRadius: 8, marginBottom: 12, border: "1px dashed #4b5563" }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, color: "#9ca3af" }}>📌 No announcement set. Add one for all members to see.</p>
              <div className="row" style={{ gap: 8 }}>
                <input
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Write an announcement..."
                  style={{ flex: 1, padding: 6, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 12 }}
                />
                <button onClick={() => setAnnouncement(selectedGroup.id, announcementText)} style={{ background: "#fbbf24", color: "#713f12", border: "none", padding: "6px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                  Pin
                </button>
              </div>
            </div>
          )}

          {/* ===== TAB NAVIGATION ===== */}
          <div className="row" style={{ gap: 4, marginBottom: 12, flexWrap: "wrap", overflowX: "auto" }}>
            {["chat", "resources", "activity", "challenges", "sessions", "quiz", "analytics", "leaderboard"].map(tab => {
              const labels = { chat: "💬 Chat", resources: "📎 Resources", activity: "📰 Activity", challenges: "🎯 Challenges", sessions: "📅 Sessions", quiz: "❓ Live Quiz", analytics: "📊 Analytics", leaderboard: "🏆 Leaderboard" };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    background: activeTab === tab ? "#FFD700" : "#374151",
                    color: "white",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: 4,
                    cursor: "pointer",
                    fontSize: 12,
                    whiteSpace: "nowrap"
                  }}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* ===== CHAT TAB ===== */}
          {activeTab === "chat" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 400, overflowY: "auto" }}>
              {(groupChat[selectedGroup.id] || []).length === 0 && (
                <p className="muted" style={{ textAlign: "center", padding: 20 }}>No messages yet. Start the conversation!</p>
              )}
              {(groupChat[selectedGroup.id] || []).map(msg => (
                <div key={msg.id} style={{
                  padding: 8,
                  background: msg.username === (username || "Student") ? "#3730a3" : "#1f2937",
                  borderRadius: 8,
                  border: msg.username === (username || "Student") ? "1px solid #FFD700" : "1px solid #374151",
                  alignSelf: msg.username === (username || "Student") ? "flex-end" : "flex-start",
                  maxWidth: "80%"
                }}>
                  <p style={{ margin: 0, fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>{msg.username}</p>
                  <p style={{ margin: "2px 0", fontSize: 13, color: "white" }}>{msg.text}</p>
                  <p style={{ margin: 0, fontSize: 10, color: "#6b7280" }}>{new Date(msg.timestamp).toLocaleTimeString()}</p>
                </div>
              ))}
              <div className="row" style={{ gap: 8, marginTop: 8, position: "sticky", bottom: 0, background: "inherit", paddingTop: 8 }}>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat(selectedGroup.id, chatInput)}
                  placeholder="Type a message..."
                  style={{ flex: 1, padding: 8, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white" }}
                />
                <button onClick={() => sendChat(selectedGroup.id, chatInput)} style={{ background: "#FFD700", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}>
                  Send
                </button>
              </div>
            </div>
          )}

          {/* ===== RESOURCES TAB ===== */}
          {activeTab === "resources" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  placeholder="Resource title..."
                  style={{ flex: 1, minWidth: 120, padding: 8, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 13 }}
                />
                <input
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  placeholder="URL (optional)"
                  style={{ flex: 2, minWidth: 150, padding: 8, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 13 }}
                />
                <button onClick={() => addResource(selectedGroup.id, resourceTitle, resourceUrl)} style={{ background: "#10b981", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
                  + Add
                </button>
              </div>
              {(groupResources[selectedGroup.id] || []).length === 0 && (
                <p className="muted">No shared resources yet.</p>
              )}
              {(groupResources[selectedGroup.id] || []).slice().reverse().map(r => (
                <div key={r.id} style={{ padding: 10, background: "#1f2937", borderRadius: 6, border: "1px solid #374151" }}>
                  <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{r.title}</p>
                  {r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#60a5fa" }}>{r.url}</a>}
                  <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>Shared by {r.addedBy} · {new Date(r.timestamp).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* ===== ACTIVITY TAB ===== */}
          {activeTab === "activity" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(groupActivity[selectedGroup.id] || []).length === 0 && (
                <p className="muted">No activity yet. Start interacting with the group!</p>
              )}
              {(groupActivity[selectedGroup.id] || []).map((a, i) => (
                <div key={i} style={{ padding: 8, background: "#1f2937", borderRadius: 6, borderLeft: "3px solid #FFD700" }}>
                  <p style={{ margin: 0, fontSize: 13, color: "#e5e7eb" }}>{a.text}</p>
                  <p className="muted" style={{ fontSize: 11, margin: "4px 0 0" }}>{new Date(a.timestamp).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* ===== CHALLENGES TAB ===== */}
          {activeTab === "challenges" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {isModerator(selectedGroup.id, username) && (
                <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                  <input
                    value={challengeTitle}
                    onChange={(e) => setChallengeTitle(e.target.value)}
                    placeholder="Challenge title (e.g. Answer 50 questions)"
                    style={{ flex: 2, minWidth: 150, padding: 8, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 13 }}
                  />
                  <input
                    type="number"
                    value={challengeTarget}
                    onChange={(e) => setChallengeTarget(Number(e.target.value))}
                    min={1}
                    style={{ width: 80, padding: 8, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 13 }}
                  />
                  <button onClick={() => createChallenge(selectedGroup.id, challengeTitle, challengeTarget)} style={{ background: "#f59e0b", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
                    Create
                  </button>
                </div>
              )}
              {groupChallenges[selectedGroup.id] ? (
                <div style={{ padding: 16, background: "#1f2937", borderRadius: 8, border: "1px solid #374151" }}>
                  <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 15 }}>🎯 {groupChallenges[selectedGroup.id].title}</p>
                  <div style={{ height: 20, background: "#374151", borderRadius: 10, marginBottom: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, (groupChallenges[selectedGroup.id].current / groupChallenges[selectedGroup.id].target) * 100)}%`,
                      background: groupChallenges[selectedGroup.id].current >= groupChallenges[selectedGroup.id].target ? "#10b981" : "#f59e0b",
                      borderRadius: 10,
                      transition: "width 0.3s"
                    }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                    {groupChallenges[selectedGroup.id].current} / {groupChallenges[selectedGroup.id].target} completed
                    {groupChallenges[selectedGroup.id].current >= groupChallenges[selectedGroup.id].target && <span style={{ color: "#10b981", marginLeft: 8 }}>✅ Completed!</span>}
                  </p>
                  <button onClick={() => incrementChallenge(selectedGroup.id)} style={{ background: "#FFD700", color: "white", border: "none", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12, marginTop: 8 }}>
                    + I did one!
                  </button>
                </div>
              ) : (
                <p className="muted">No active challenge. {isModerator(selectedGroup.id, username) ? "Create one above!" : "Wait for a moderator to start one."}</p>
              )}
            </div>
          )}

          {/* ===== SESSIONS TAB ===== */}
          {activeTab === "sessions" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <input
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  placeholder="Session title (e.g. Chapter 5 Review)"
                  style={{ flex: 2, minWidth: 150, padding: 8, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 13 }}
                />
                <input
                  type="datetime-local"
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  style={{ flex: 1, minWidth: 150, padding: 8, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 13 }}
                />
                <button onClick={() => scheduleSession(selectedGroup.id, sessionTitle, sessionTime)} style={{ background: "#FFD700", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer", fontSize: 13 }}>
                  Schedule
                </button>
              </div>
              {(groupSessions[selectedGroup.id] || []).length === 0 && (
                <p className="muted">No study sessions scheduled.</p>
              )}
              {(groupSessions[selectedGroup.id] || []).slice().reverse().map(s => {
                const isPast = new Date(s.scheduledAt) < new Date();
                const hasJoined = (s.joinedBy || []).includes(username || "Student");
                return (
                  <div key={s.id} style={{ padding: 12, background: "#1f2937", borderRadius: 6, border: "1px solid #374151", opacity: isPast ? 0.6 : 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <p style={{ margin: 0, fontWeight: 500, fontSize: 14 }}>{s.title}</p>
                      <span style={{ fontSize: 11, color: isPast ? "#ef4444" : "#10b981" }}>{isPast ? "Past" : "Upcoming"}</span>
                    </div>
                    <p className="muted" style={{ fontSize: 12, margin: "4px 0" }}>📅 {new Date(s.scheduledAt).toLocaleString()}</p>
                    <p className="muted" style={{ fontSize: 11, margin: 0 }}>By {s.createdBy} · {(s.joinedBy || []).length} joined</p>
                    {!isPast && !hasJoined && (
                      <button onClick={() => joinSession(selectedGroup.id, s.id)} style={{ background: "#10b981", color: "white", border: "none", padding: "4px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, marginTop: 6 }}>
                        Join Session
                      </button>
                    )}
                    {!isPast && hasJoined && (
                      <span style={{ fontSize: 12, color: "#10b981", marginTop: 6, display: "inline-block" }}>✓ You're going</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ===== LIVE QUIZ TAB ===== */}
          {activeTab === "quiz" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!quizMode && !liveQuiz && (
                <div style={{ textAlign: "center", padding: 20 }}>
                  <p className="muted">Start a live quiz for all group members to answer.</p>
                  {isModerator(selectedGroup.id, username) && (
                    <button onClick={() => setQuizMode(true)} style={{ background: "#FFD700", color: "white", border: "none", padding: "10px 24px", borderRadius: 6, cursor: "pointer", fontSize: 14, marginTop: 8 }}>
                      🚀 Start Live Quiz
                    </button>
                  )}
                </div>
              )}
              {quizMode && !liveQuiz && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <input value={quizQuestion} onChange={(e) => setQuizQuestion(e.target.value)} placeholder="Question..." style={{ padding: 8, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white" }} />
                  {quizOptions.map((opt, i) => (
                    <div key={i} className="row" style={{ gap: 8 }}>
                      <input type="radio" name="quizAnswer" checked={quizAnswer === i} onChange={() => setQuizAnswer(i)} />
                      <input value={opt} onChange={(e) => { const next = [...quizOptions]; next[i] = e.target.value; setQuizOptions(next); }} placeholder={`Option ${String.fromCharCode(65 + i)}`} style={{ flex: 1, padding: 6, background: "#374151", border: "1px solid #4b5563", borderRadius: 4, color: "white", fontSize: 13 }} />
                    </div>
                  ))}
                  <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => setQuizMode(false)} style={{ background: "#374151", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}>Cancel</button>
                    <button onClick={() => startLiveQuiz(selectedGroup.id, quizQuestion, quizOptions, quizAnswer)} style={{ background: "#FFD700", color: "white", border: "none", padding: "8px 16px", borderRadius: 4, cursor: "pointer" }}>Launch Quiz</button>
                  </div>
                </div>
              )}
              {liveQuiz && (
                <div style={{ padding: 16, background: "#1e3a5f", borderRadius: 8, border: "1px solid #FFD700" }}>
                  <p style={{ margin: "0 0 12px", fontWeight: 600, fontSize: 15 }}>❓ {liveQuiz.question}</p>
                  {liveQuiz.options.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => answerLiveQuiz(i)}
                      disabled={liveQuiz.responses?.[username || "Student"] !== undefined}
                      style={{
                        display: "block", width: "100%", marginBottom: 8, padding: 10,
                        background: liveQuiz.responses?.[username || "Student"] === i ? "#3730a3" : "#1f2937",
                        border: liveQuiz.responses?.[username || "Student"] === i ? "2px solid #FFD700" : "1px solid #374151",
                        borderRadius: 6, color: "white", textAlign: "left", cursor: "pointer"
                      }}
                    >
                      {String.fromCharCode(65 + i)}. {opt}
                      {liveQuiz.responses?.[username || "Student"] === i && <span style={{ float: "right", color: "#FFD700" }}>✓</span>}
                    </button>
                  ))}
                  <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
                    {Object.keys(liveQuiz.responses || {}).length} / {selectedGroup.memberCount} answered
                  </p>
                  {isModerator(selectedGroup.id, username) && (
                    <button onClick={endLiveQuiz} style={{ background: "#ef4444", color: "white", border: "none", padding: "6px 16px", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>
                      End Quiz & Show Results
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== ANALYTICS TAB ===== */}
          {activeTab === "analytics" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120, padding: 12, background: "#1f2937", borderRadius: 8, textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#fbbf24" }}>{selectedGroup.memberCount}</p>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>Members</p>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: 12, background: "#1f2937", borderRadius: 8, textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#10b981" }}>{selectedGroup.totalXP}</p>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>Total XP</p>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: 12, background: "#1f2937", borderRadius: 8, textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#FFD700" }}>{selectedGroup.totalSessions}</p>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>Sessions</p>
                </div>
                <div style={{ flex: 1, minWidth: 120, padding: 12, background: "#1f2937", borderRadius: 8, textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f59e0b" }}>
                    {selectedGroup.memberCount > 0 ? Math.round(selectedGroup.totalXP / selectedGroup.memberCount) : 0}
                  </p>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 12 }}>Avg XP</p>
                </div>
              </div>
              <div style={{ padding: 12, background: "#1f2937", borderRadius: 8 }}>
                <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14 }}>📈 Recent Activity</p>
                <p className="muted" style={{ fontSize: 12 }}>
                  {(groupActivity[selectedGroup.id] || []).filter(a => a.timestamp > Date.now() - 7 * 24 * 60 * 60 * 1000).length} events in the last 7 days
                </p>
                <p className="muted" style={{ fontSize: 12 }}>
                  {(groupChat[selectedGroup.id] || []).length} chat messages total
                </p>
                <p className="muted" style={{ fontSize: 12 }}>
                  {(groupResources[selectedGroup.id] || []).length} shared resources
                </p>
              </div>
            </div>
          )}

          {/* ===== LEADERBOARD TAB ===== */}
          {activeTab === "leaderboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sortedMembers.map((member, index) => {
                const isCurrentUser = member.username === username;
                const rank = index + 1;
                let rankIcon = "";
                if (rank === 1) rankIcon = "🥇";
                else if (rank === 2) rankIcon = "🥈";
                else if (rank === 3) rankIcon = "🥉";
                else rankIcon = `#${rank}`;

                return (
                  <div
                    key={member.username}
                    style={{
                      padding: 12,
                      background: isCurrentUser ? "#3730a3" : "#1f2937",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      border: isCurrentUser ? "2px solid #FFD700" : "1px solid #374151"
                    }}
                  >
                    <span style={{ fontSize: 24, minWidth: 40 }}>{rankIcon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        {member.username} {member.isCreator && "👑"} {member.isModerator && "🛡️"}
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        {member.sessions} sessions · Joined {new Date(member.joinedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 18, fontWeight: 700, color: "#fbbf24" }}>
                        {member.xp} XP
                      </div>
                    </div>
                    {isModerator(selectedGroup.id, username) && member.username !== (username || "Student") && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {!member.isModerator && isCreator(selectedGroup.id, username) && (
                          <button onClick={() => promoteMember(selectedGroup.id, member.username)} style={{ background: "#FFD700", color: "white", border: "none", padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>
                            Promote
                          </button>
                        )}
                        <button onClick={() => { if (confirm(`Remove ${member.username}?`)) kickMember(selectedGroup.id, member.username); }} style={{ background: "#ef4444", color: "white", border: "none", padding: "2px 8px", borderRadius: 4, cursor: "pointer", fontSize: 10 }}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000
        }}>
          <div style={{
            background: "#1f2937",
            padding: 24,
            borderRadius: 12,
            maxWidth: 400,
            width: "90%"
          }}>
            <h3 style={{ margin: "0 0 16px 0" }}>Create Study Group</h3>
            
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Group Name</label>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g., Biology Study Squad"
                style={{
                  width: "100%",
                  padding: 8,
                  background: "#374151",
                  border: "1px solid #4b5563",
                  borderRadius: 4,
                  color: "white"
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13 }}>Subject (optional)</label>
              <select
                value={newGroupSubject}
                onChange={(e) => setNewGroupSubject(e.target.value)}
                style={{
                  width: "100%",
                  padding: 8,
                  background: "#374151",
                  border: "1px solid #4b5563",
                  borderRadius: 4,
                  color: "white"
                }}
              >
                <option value="">-- No specific subject --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon} {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  background: "#374151",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 4,
                  cursor: "pointer"
                }}
              >
                Cancel
              </button>
              <button
                onClick={createGroup}
                disabled={!newGroupName.trim()}
                style={{
                  background: "#FFD700",
                  color: "white",
                  border: "none",
                  padding: "8px 16px",
                  borderRadius: 4,
                  cursor: "pointer",
                  opacity: !newGroupName.trim() ? 0.5 : 1
                }}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
