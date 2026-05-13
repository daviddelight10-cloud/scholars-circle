import React, { useState } from "react";
import { LecturerDirectory } from "./LecturerDirectory.jsx";
import { LecturerProfileView } from "./LecturerProfileView.jsx";
import { LecturerProfileEditor } from "./LecturerProfileEditor.jsx";
import { Messages } from "./Messages.jsx";

export default function Lecturers({ token, currentUser, isTeacher }) {
  // view: "directory" | "profile" | "editor" | "messages"
  const [view, setView] = useState("directory");
  const [selected, setSelected] = useState(null);
  const [messageTarget, setMessageTarget] = useState(null);

  function handleSelect(lecturer) {
    setSelected(lecturer);
    setView("profile");
  }

  function handleMessage(lecturer) {
    setMessageTarget({
      id: lecturer.id,
      userId: lecturer.userId,
      partnerId: lecturer.userId,
      displayName: `${lecturer.title ? lecturer.title + " " : ""}${lecturer.fullName}`,
      fullName: lecturer.fullName
    });
    setView("messages");
  }

  return (
    <div>
      {/* Top tab nav */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={() => { setView("directory"); setSelected(null); }} style={view === "directory" ? activeTab : tab}>
          🔍 Directory
        </button>
        <button onClick={() => { setView("messages"); setMessageTarget(null); }} style={view === "messages" ? activeTab : tab}>
          💬 Messages
        </button>
        {isTeacher && (
          <button onClick={() => setView("editor")} style={view === "editor" ? activeTab : tab}>
            ✏️ My Lecturer Profile
          </button>
        )}
      </div>

      {view === "directory" && (
        <LecturerDirectory
          token={token}
          onSelect={handleSelect}
          onMessage={handleMessage}
        />
      )}

      {view === "profile" && selected && (
        <LecturerProfileView
          lecturerId={selected.id}
          token={token}
          currentUser={currentUser}
          onBack={() => { setView("directory"); setSelected(null); }}
          onMessage={handleMessage}
        />
      )}

      {view === "editor" && (
        <LecturerProfileEditor token={token} onSaved={() => {}} />
      )}

      {view === "messages" && (
        <Messages
          token={token}
          currentUser={currentUser}
          initialPartner={messageTarget}
          onBack={() => { setView("directory"); setMessageTarget(null); }}
        />
      )}
    </div>
  );
}

const tab = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(99,102,241,0.2)",
  background: "rgba(30,41,59,0.6)",
  color: "#a5b4fc",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600
};

const activeTab = {
  ...tab,
  border: "2px solid #818cf8",
  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
  color: "#fff"
};
