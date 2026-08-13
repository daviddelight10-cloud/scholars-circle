import React, { useState, useEffect, useRef } from "react";
import { useToast } from "./Toast";
import { LiveSessionsPanel } from "../features/LiveSessions/LiveSessionsPanel.jsx";
import { ClassroomAssignmentsPanel } from "../features/ClassroomAssignments/ClassroomAssignmentsPanel.jsx";
import { AttendancePanel } from "../features/LiveSessions/AttendancePanel.jsx";
import { BulkImport, AIQuestionGen } from "./SmallComponents";

const TABS = [
  { id: "announcements", icon: "📢", label: "Announcements" },
  { id: "sessions", icon: "🎥", label: "Live Sessions" },
  { id: "assignments", icon: "📝", label: "Assignments" },
  { id: "docs", icon: "📄", label: "Docs & Links" },
  { id: "attendance", icon: "📋", label: "Attendance" },
];

export function Classroom({ subjects, assignments, teacherMode, setTeacherMode, onCreate, onComplete, onImportQuestions, token, currentUser }) {
  const toast = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassroom, setSelectedClassroom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [showJoinClass, setShowJoinClass] = useState(false);
  const [joinClassCode, setJoinClassCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [newLinkTitle, setNewLinkTitle] = useState("");
  const [newLinkUrl, setNewLinkUrl] = useState("");
  const [popupLink, setPopupLink] = useState(null);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "", isImportant: false });
  const [showAnnouncementPopup, setShowAnnouncementPopup] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [showExamModal, setShowExamModal] = useState(false);
  const [newExam, setNewExam] = useState({ title: "", examDate: "", duration: 60 });
  const [classTab, setClassTab] = useState("announcements");
  const [isMobile, setIsMobile] = useState(typeof window !== "undefined" && window.innerWidth < 768);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showAnnounceComposer, setShowAnnounceComposer] = useState(false);
  const [showQuestionTools, setShowQuestionTools] = useState(false);
  const touchStartX = useRef(null);

  const API_BASE = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_BASE || "https://scholars-circle-production.up.railway.app";

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_BASE}/classroom/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        setClassrooms(data || []);
        if (data && data.length > 0 && !selectedClassroom) setSelectedClassroom(data[0]);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setInitialLoadDone(true); });
  }, [token]);

  useEffect(() => {
    if (!token || !selectedClassroom?.id) return;
    fetch(`${API_BASE}/classroom/${selectedClassroom.id}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => setSelectedClassroom(data))
      .catch(() => {});
  }, [token, selectedClassroom?.id]);

  useEffect(() => {
    if (selectedClassroom?.announcements) {
      const unreadImportant = selectedClassroom.announcements.find((a) => a.isImportant && (!a.reads || a.reads.length === 0));
      if (unreadImportant) setShowAnnouncementPopup(unreadImportant);
    }
  }, [selectedClassroom?.announcements]);

  async function createClassroom() {
    if (!newClassName.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/classroom`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newClassName, subjectId }) });
      const data = await res.json();
      setClassrooms((prev) => [...prev, data]);
      setNewClassName("");
      setShowCreateClass(false);
    } catch (err) { console.error("Failed to create classroom:", err); }
  }

  async function joinClassroom() {
    if (!joinClassCode.trim()) return;
    setJoinError("");
    try {
      const res = await fetch(`${API_BASE}/classroom/${joinClassCode}/join`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join classroom");
      const classroomsRes = await fetch(`${API_BASE}/classroom/my`, { headers: { Authorization: `Bearer ${token}` } });
      const classroomsData = await classroomsRes.json();
      setClassrooms(classroomsData || []);
      if (classroomsData && classroomsData.length > 0) setSelectedClassroom(classroomsData[classroomsData.length - 1]);
      setJoinClassCode("");
      setShowJoinClass(false);
    } catch (err) { setJoinError(err.message); }
  }

  async function addLink() {
    if (!newLinkTitle.trim() || !newLinkUrl.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/links`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ title: newLinkTitle, url: newLinkUrl }) });
      const link = await res.json();
      setSelectedClassroom((prev) => ({ ...prev, links: [...(prev.links || []), link] }));
      setNewLinkTitle(""); setNewLinkUrl("");
    } catch (err) { console.error("Failed to add link:", err); }
  }

  async function createAnnouncement() {
    if (!newAnnouncement.title.trim() || !newAnnouncement.content.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/announcements`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newAnnouncement) });
      const announcement = await res.json();
      setSelectedClassroom((prev) => ({ ...prev, announcements: [announcement, ...(prev.announcements || [])] }));
      setNewAnnouncement({ title: "", content: "", isImportant: false });
      setShowAnnounceComposer(false);
    } catch (err) { console.error("Failed to create announcement:", err); }
  }

  async function uploadDocument(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingDoc(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", file.name);
    try {
      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/documents`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
      const doc = await res.json();
      setSelectedClassroom((prev) => ({ ...prev, documents: [...(prev.documents || []), doc] }));
    } catch (err) { console.error("Failed to upload document:", err); }
    finally { setUploadingDoc(false); }
  }

  async function createExam() {
    if (!newExam.title.trim() || !newExam.examDate) return;
    try {
      const res = await fetch(`${API_BASE}/classroom/${selectedClassroom.id}/exams`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(newExam) });
      const exam = await res.json();
      setSelectedClassroom((prev) => ({ ...prev, exams: [...(prev.exams || []), exam] }));
      setShowExamModal(false);
      setNewExam({ title: "", examDate: "", duration: 60 });
    } catch (err) { console.error("Failed to create exam:", err); }
  }

  async function markAnnouncementRead(announcementId) {
    try { await fetch(`${API_BASE}/classroom/announcements/${announcementId}/read`, { method: "POST", headers: { Authorization: `Bearer ${token}` } }); }
    catch (err) { console.error("Failed to mark as read:", err); }
  }

  function getDaysUntilExam(examDate) {
    return Math.ceil((new Date(examDate) - new Date()) / (1000 * 60 * 60 * 24));
  }

  const isHost = teacherMode && selectedClassroom?.createdById === (currentUser?.id || currentUser?.sub);
  const announcements = selectedClassroom?.announcements || [];
  const links = selectedClassroom?.links || [];
  const documents = selectedClassroom?.documents || [];
  const exams = selectedClassroom?.exams || [];
  const memberCount = selectedClassroom?._count?.members ?? 0;

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 60) {
      const idx = TABS.findIndex((t) => t.id === classTab);
      const nextIdx = diff < 0 ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
      setClassTab(TABS[nextIdx].id);
    }
    touchStartX.current = null;
  }

  function getInitials(name) {
    if (!name) return "?";
    const words = name.trim().split(/\s+/);
    return (words[0]?.[0] || "?") + (words[1]?.[0] || "");
  }

  return (
    <div className="cr-shell" style={{ flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#f1f5f9", fontFamily: "Syne, sans-serif", flex: 1 }}>🏫 Classroom</div>
        {teacherMode
          ? <button className="cr-btn-outline" onClick={() => setShowCreateClass(true)}>+ New Class</button>
          : <button className="cr-btn-outline" onClick={() => setShowJoinClass(true)}>🔗 Join Class</button>
        }
      </div>

      {loading && !initialLoadDone && (
        <div className="cr-glass" style={{ textAlign: "center", padding: 40 }}>
          <div className="spinner spinner-lg" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 13, color: "#6b7280" }}>Loading classrooms…</div>
        </div>
      )}

      {initialLoadDone && classrooms.length === 0 && (
        <div className="cr-empty">
          <div className="cr-empty-icon">🏫</div>
          <div className="cr-empty-title">{teacherMode ? "No classrooms yet" : "You haven't joined a classroom"}</div>
          <div className="cr-empty-desc">{teacherMode ? "Create your first classroom to get started." : "Ask your teacher for the Classroom ID to join."}</div>
          {teacherMode
            ? <button className="cr-btn" onClick={() => setShowCreateClass(true)}>+ Create Classroom</button>
            : <button className="cr-btn" onClick={() => setShowJoinClass(true)}>🔗 Join a Classroom</button>
          }
        </div>
      )}

      {classrooms.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: isMobile ? "column" : "row" }}>
          {/* Mobile classroom chips */}
          {isMobile && (
            <div className="cr-chips" style={{ width: "100%" }}>
              {classrooms.map(c => (
                <div key={c.id} className={`cr-chip ${selectedClassroom?.id === c.id ? "active" : ""}`} onClick={() => setSelectedClassroom(c)}>
                  {c.name}
                </div>
              ))}
            </div>
          )}

          {/* Desktop sidebar */}
          {!isMobile && (
            <div className={`cr-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
              <button className="cr-sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
                {sidebarCollapsed ? "▶" : "◀ Collapse"}
              </button>
              {classrooms.map(c => (
                <button key={c.id} className={`cr-class-item ${selectedClassroom?.id === c.id ? "active" : ""}`} onClick={() => setSelectedClassroom(c)}>
                  <div className="cr-class-avatar">{getInitials(c.name)}</div>
                  <div className="cr-class-info">
                    <div className="cr-class-name">{c.name}</div>
                    <div className="cr-class-meta">{c._count?.members ?? 0} members</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Desktop tab rail */}
          {!isMobile && (
            <div className="cr-tab-rail">
              {TABS.map(t => (
                <button key={t.id} className={`cr-tab-btn ${classTab === t.id ? "active" : ""}`} data-label={t.label} onClick={() => setClassTab(t.id)}>
                  {t.icon}
                </button>
              ))}
            </div>
          )}

          {/* Content area */}
          <div className="cr-content" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {selectedClassroom && (
              <>
                {/* Header bar */}
                <div className="cr-header">
                  <div style={{ flex: 1 }}>
                    <div className="cr-header-title">{selectedClassroom.name}</div>
                    {teacherMode && (
                      <div className="cr-header-sub">
                        ID: <code style={{ background: "rgba(10,10,10,0.8)", padding: "1px 6px", borderRadius: 5, color: "#6b7280", fontSize: 10 }}>{selectedClassroom.id}</code>
                        <button onClick={() => navigator.clipboard.writeText(selectedClassroom.id)} style={{ background: "none", border: "none", color: "#FFD700", cursor: "pointer", fontSize: 10, padding: 0 }}>Copy</button>
                      </div>
                    )}
                  </div>
                  {exams.length > 0 && (
                    <div className="cr-header-badge" style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#fbbf24" }}>
                      📅 {getDaysUntilExam(exams[0].examDate)}d until {exams[0].title}
                      <button onClick={() => { if (window.confirm("Start Exam Mode?")) window.dispatchEvent(new CustomEvent("startExamMode", { detail: exams[0] })); }} style={{ marginLeft: 4, background: "#ef4444", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#fff", cursor: "pointer" }}>Prep</button>
                    </div>
                  )}
                  {teacherMode && <button className="cr-btn-ghost" onClick={() => setShowExamModal(true)}>📅 Add Exam</button>}
                </div>

                {/* Mobile tab bar */}
                {isMobile && (
                  <div className="cr-mobile-tabs">
                    {TABS.map(t => (
                      <button key={t.id} className={`cr-mobile-tab ${classTab === t.id ? "active" : ""}`} onClick={() => setClassTab(t.id)}>
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Stat dashboards */}
                <div className="cr-stats">
                  {teacherMode ? (
                    <>
                      <div className="cr-stat"><div className="cr-stat-icon">👥</div><div className="cr-stat-value">{memberCount}</div><div className="cr-stat-label">Students</div></div>
                      <div className="cr-stat"><div className="cr-stat-icon">📢</div><div className="cr-stat-value">{announcements.length}</div><div className="cr-stat-label">Announcements</div></div>
                      <div className="cr-stat"><div className="cr-stat-icon">📄</div><div className="cr-stat-value">{documents.length + links.length}</div><div className="cr-stat-label">Resources</div></div>
                      <div className="cr-stat"><div className="cr-stat-icon">📅</div><div className="cr-stat-value">{exams.length}</div><div className="cr-stat-label">Exams</div></div>
                    </>
                  ) : (
                    <>
                      <div className="cr-stat"><div className="cr-stat-icon">📢</div><div className="cr-stat-value">{announcements.length}</div><div className="cr-stat-label">Announcements</div></div>
                      <div className="cr-stat"><div className="cr-stat-icon">🔗</div><div className="cr-stat-value">{links.length}</div><div className="cr-stat-label">Quick Links</div></div>
                      <div className="cr-stat"><div className="cr-stat-icon">📄</div><div className="cr-stat-value">{documents.length}</div><div className="cr-stat-label">Documents</div></div>
                      <div className="cr-stat"><div className="cr-stat-icon">📅</div><div className="cr-stat-value">{exams.length}</div><div className="cr-stat-label">Exams</div></div>
                    </>
                  )}
                </div>

                {/* Tab content */}
                <div key={classTab} className="cr-tab-content">

                {classTab === "announcements" && (
                  <div>
                    {teacherMode && (
                      <div className="cr-collapsible">
                        <div className="cr-collapsible-header" onClick={() => setShowAnnounceComposer(!showAnnounceComposer)}>
                          <span>📢 Post Announcement</span>
                          <span>{showAnnounceComposer ? "▲" : "▼"}</span>
                        </div>
                        {showAnnounceComposer && (
                          <div className="cr-collapsible-body">
                            <input className="cr-input" value={newAnnouncement.title} onChange={e => setNewAnnouncement(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title" style={{ marginBottom: 8 }} />
                            <textarea className="cr-input" value={newAnnouncement.content} onChange={e => setNewAnnouncement(p => ({ ...p, content: e.target.value }))} placeholder="Announcement content…" rows={3} style={{ marginBottom: 8, resize: "vertical" }} />
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#9ca3af", cursor: "pointer" }}>
                                <input type="checkbox" checked={newAnnouncement.isImportant} onChange={e => setNewAnnouncement(p => ({ ...p, isImportant: e.target.checked }))} />⚠️ Important
                              </label>
                              <button className="cr-btn" style={{ marginLeft: "auto" }} onClick={createAnnouncement}>Post</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {announcements.length === 0 ? (
                      <div className="cr-empty" style={{ padding: "32px 20px" }}>
                        <div className="cr-empty-icon">📭</div>
                        <div className="cr-empty-title">No announcements yet</div>
                        <div className="cr-empty-desc">{teacherMode ? "Post your first announcement above." : "Check back later for updates."}</div>
                      </div>
                    ) : (
                      announcements.map(a => (
                        <div key={a.id} className={`cr-announcement ${a.isImportant ? "important" : ""}`}>
                          <div className="cr-announcement-title">{a.isImportant ? "⚠️ " : ""}{a.title}</div>
                          <div className="cr-announcement-body">{a.content}</div>
                          <div className="cr-announcement-time">{new Date(a.createdAt).toLocaleString()}</div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {classTab === "sessions" && (
                  <LiveSessionsPanel classroomId={selectedClassroom.id} classroomName={selectedClassroom.name} isHost={isHost} currentUser={currentUser} token={token} />
                )}

                {classTab === "assignments" && (
                  <div>
                    <ClassroomAssignmentsPanel classroomId={selectedClassroom.id} isHost={isHost} currentUser={currentUser} token={token} />
                    {assignments.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div className="cr-section-label">Legacy Assignments</div>
                        {assignments.map(a => {
                          const subj = subjects.find(s => s.id === a.subjectId);
                          return (
                            <div key={a.id} className="cr-glass-flat" style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 7 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9" }}>{a.title}</div>
                                <div style={{ fontSize: 10, color: "#6b7280" }}>{subj?.label || ""}{a.due ? ` · Due ${a.due}` : ""}</div>
                              </div>
                              <button className={a.done ? "cr-btn-outline" : "cr-btn"} style={a.done ? { borderColor: "rgba(16,185,129,0.4)", color: "#10b981" } : {}} onClick={() => onComplete(a.id)}>
                                {a.done ? "✓ Done" : "Mark Done"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {classTab === "docs" && (
                  <div>
                    <div className="cr-glass" style={{ marginBottom: 10 }}>
                      <div className="cr-section-label">Quick Links</div>
                      {teacherMode && (
                        <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
                          <input className="cr-input" value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder="Link name" style={{ flex: 1, minWidth: 100 }} />
                          <input className="cr-input" value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://…" style={{ flex: 2, minWidth: 140 }} />
                          <button className="cr-btn" onClick={addLink}>Add</button>
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {links.map(link => (
                          <button key={link.id} className="cr-link-pill" onClick={() => setPopupLink(link)}>🔗 {link.title}</button>
                        ))}
                        {links.length === 0 && <span style={{ fontSize: 12, color: "#6b7280" }}>No links yet.</span>}
                      </div>
                    </div>
                    <div className="cr-glass">
                      <div className="cr-section-label">Documents</div>
                      {teacherMode && (
                        <div style={{ marginBottom: 10 }}>
                          <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={uploadDocument} disabled={uploadingDoc} style={{ fontSize: 11 }} />
                          {uploadingDoc && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>Uploading…</span>}
                        </div>
                      )}
                      {documents.map(doc => (
                        <div key={doc.id} className="cr-doc-card">
                          <span style={{ fontSize: 18 }}>{doc.fileType === "pdf" ? "📕" : doc.fileType === "docx" ? "📘" : "📄"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                            <div style={{ fontSize: 10, color: "#6b7280" }}>{doc.fileType?.toUpperCase()} · {(doc.fileSize / 1024).toFixed(1)} KB</div>
                          </div>
                          <button className="cr-btn-outline" style={{ borderColor: "rgba(16,185,129,0.3)", color: "#10b981" }} onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE}/classroom/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
                              if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Download failed"); }
                              const blob = await res.blob(); const url = URL.createObjectURL(blob);
                              const link = document.createElement("a"); link.href = url; link.download = doc.filename || doc.title || "document";
                              document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                            } catch (err) { toast.error("Download failed: " + err.message); }
                          }}>⬇️ Download</button>
                        </div>
                      ))}
                      {documents.length === 0 && <span style={{ fontSize: 12, color: "#6b7280" }}>No documents yet.</span>}
                    </div>
                  </div>
                )}

                {classTab === "attendance" && (
                  <AttendancePanel classroomId={selectedClassroom.id} isHost={isHost} token={token} />
                )}

                {teacherMode && (
                  <div className="cr-collapsible" style={{ marginTop: 14 }}>
                    <div className="cr-collapsible-header" onClick={() => setShowQuestionTools(!showQuestionTools)}>
                      <span>🛠️ Question Tools (Bulk Import & AI Generate)</span>
                      <span>{showQuestionTools ? "▲" : "▼"}</span>
                    </div>
                    {showQuestionTools && (
                      <div className="cr-collapsible-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <BulkImport onImportQuestions={onImportQuestions} />
                        <AIQuestionGen onImportQuestions={onImportQuestions} />
                      </div>
                    )}
                  </div>
                )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showCreateClass && (
        <div className="modal-overlay" onClick={() => setShowCreateClass(false)}>
          <div className="modal-content cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">Create New Classroom</h3>
            <input className="cr-input" value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Classroom name (e.g., 'MTH111 - 2024')" style={{ marginBottom: 10 }} />
            <select className="cr-input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ marginBottom: 14 }}>
              <option value="">Select Subject (optional)</option>
              {subjects.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cr-btn-outline" style={{ flex: 1 }} onClick={() => setShowCreateClass(false)}>Cancel</button>
              <button className="cr-btn" style={{ flex: 1 }} onClick={createClassroom}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showJoinClass && (
        <div className="modal-overlay" onClick={() => { setShowJoinClass(false); setJoinError(""); }}>
          <div className="modal-content cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">🔗 Join Classroom</h3>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Enter the Classroom ID provided by your teacher.</p>
            <input className="cr-input" value={joinClassCode} onChange={(e) => setJoinClassCode(e.target.value)} placeholder="Classroom ID (e.g., 'abc123')" style={{ marginBottom: 8 }} />
            {joinError && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{joinError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cr-btn-outline" style={{ flex: 1 }} onClick={() => { setShowJoinClass(false); setJoinError(""); }}>Cancel</button>
              <button className="cr-btn" style={{ flex: 1 }} onClick={joinClassroom}>Join</button>
            </div>
          </div>
        </div>
      )}

      {popupLink && (
        <div className="modal-overlay" onClick={() => setPopupLink(null)}>
          <div className="modal-content cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">🔗 {popupLink.title}</h3>
            <p style={{ wordBreak: "break-all", color: "#FFD700", marginBottom: 16, fontSize: 13 }}>{popupLink.url}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cr-btn-outline" style={{ flex: 1 }} onClick={() => setPopupLink(null)}>Close</button>
              <button className="cr-btn" style={{ flex: 1 }} onClick={() => { window.open(popupLink.url, "_blank"); setPopupLink(null); }}>Open Link</button>
            </div>
          </div>
        </div>
      )}

      {showAnnouncementPopup && (
        <div className="modal-overlay" onClick={() => { markAnnouncementRead(showAnnouncementPopup.id); setShowAnnouncementPopup(null); }}>
          <div className="modal-content cr-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, border: "2px solid rgba(239,68,68,0.5)", background: "linear-gradient(135deg, rgba(20,20,20,0.95), rgba(239,68,68,0.1))" }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 40 }}>⚠️</span>
              <h3 style={{ color: "#fbbf24", margin: "4px 0 0 0" }}>Important Announcement</h3>
            </div>
            <h4 style={{ margin: "0 0 8px 0" }}>{showAnnouncementPopup.title}</h4>
            <p style={{ marginBottom: 14, fontSize: 14, lineHeight: 1.6 }}>{showAnnouncementPopup.content}</p>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>Posted: {new Date(showAnnouncementPopup.createdAt).toLocaleString()}</div>
            <button className="cr-btn" style={{ width: "100%", background: "rgba(239,68,68,0.2)", borderColor: "rgba(239,68,68,0.4)" }} onClick={() => { markAnnouncementRead(showAnnouncementPopup.id); setShowAnnouncementPopup(null); }}>Got it!</button>
          </div>
        </div>
      )}

      {showExamModal && (
        <div className="modal-overlay" onClick={() => setShowExamModal(false)}>
          <div className="modal-content cr-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cr-modal-title">📅 Add Exam</h3>
            <input className="cr-input" value={newExam.title} onChange={(e) => setNewExam((prev) => ({ ...prev, title: e.target.value }))} placeholder="Exam title (e.g., 'MTH111 Mid-Semester')" style={{ marginBottom: 10 }} />
            <input className="cr-input" type="datetime-local" value={newExam.examDate} onChange={(e) => setNewExam((prev) => ({ ...prev, examDate: e.target.value }))} style={{ marginBottom: 10 }} />
            <input className="cr-input" type="number" value={newExam.duration} onChange={(e) => setNewExam((prev) => ({ ...prev, duration: parseInt(e.target.value) }))} placeholder="Duration (minutes)" style={{ marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="cr-btn-outline" style={{ flex: 1 }} onClick={() => setShowExamModal(false)}>Cancel</button>
              <button className="cr-btn" style={{ flex: 1 }} onClick={createExam}>Add Exam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Classroom;
