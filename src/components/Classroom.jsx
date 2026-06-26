import React, { useState, useEffect, useRef } from "react";
import { useToast } from "./Toast";
import { LiveSessionsPanel } from "../features/LiveSessions/LiveSessionsPanel.jsx";
import { ClassroomAssignmentsPanel } from "../features/ClassroomAssignments/ClassroomAssignmentsPanel.jsx";
import { AttendancePanel } from "../features/LiveSessions/AttendancePanel.jsx";
import { BulkImport, AIQuestionGen } from "./SmallComponents";

export function Classroom({ subjects, assignments, teacherMode, setTeacherMode, onCreate, onComplete, onImportQuestions, token, currentUser }) {
  const toast = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
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
  const tabListRef = useRef(null);
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
  const CL = { card: "#0d0f1f", line: "#1e2140", border: "#3949ab", text: "#e8eaf6", muted: "#7b82b8", hint: "#4a5080", faint: "#12142a" };

  const TABS = [
    { id: "announcements", label: "📢 Announcements" },
    { id: "sessions", label: "🎥 Live Sessions" },
    { id: "assignments", label: "📝 Assignments" },
    { id: "docs", label: "📄 Docs & Links" },
    { id: "attendance", label: "📋 Attendance" },
  ];

  function goToTab(direction) {
    const idx = TABS.findIndex((t) => t.id === classTab);
    const nextIdx = direction === "next" ? (idx + 1) % TABS.length : (idx - 1 + TABS.length) % TABS.length;
    setClassTab(TABS[nextIdx].id);
    if (tabListRef.current) {
      const btn = tabListRef.current.children[nextIdx];
      if (btn) btn.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 60) { goToTab(diff < 0 ? "next" : "prev"); }
    touchStartX.current = null;
  }

  const classroomCard = (c) => (
    <div key={c.id} onClick={() => setSelectedClassroom(c)} style={{
      background: selectedClassroom?.id === c.id ? "#1a237e" : CL.card,
      border: `0.5px solid ${selectedClassroom?.id === c.id ? CL.border : CL.line}`,
      borderRadius: 12, padding: "10px 12px", cursor: "pointer", transition: "background 0.15s",
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: CL.text, fontFamily: "Manrope,sans-serif", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
      <div style={{ fontSize: 10, color: CL.hint }}>{c._count?.members ?? 0} members</div>
    </div>
  );

  return (
    <div style={{ fontFamily: "Manrope, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: CL.text, fontFamily: "Syne,sans-serif", flex: 1 }}>🏫 Classroom</div>
        {teacherMode
          ? <button onClick={() => setShowCreateClass(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 10, padding: "7px 14px", fontSize: 12, color: CL.border, cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>+ New Class</button>
          : <button onClick={() => setShowJoinClass(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 10, padding: "7px 14px", fontSize: 12, color: CL.border, cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600 }}>🔗 Join Class</button>
        }
      </div>

      {loading && !initialLoadDone && <p style={{ color: CL.muted, fontSize: 13 }}>Loading…</p>}

      {initialLoadDone && classrooms.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 16 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🏫</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: CL.text, marginBottom: 6, fontFamily: "Syne,sans-serif" }}>
            {teacherMode ? "No classrooms yet" : "You haven't joined a classroom"}
          </div>
          <div style={{ fontSize: 12, color: CL.muted, marginBottom: 16 }}>
            {teacherMode ? "Create your first classroom to get started." : "Ask your teacher for the Classroom ID to join."}
          </div>
          {teacherMode
            ? <button onClick={() => setShowCreateClass(true)} style={{ background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 10, padding: "8px 18px", fontSize: 12, color: "#c5cae9", cursor: "pointer" }}>+ Create Classroom</button>
            : <button onClick={() => setShowJoinClass(true)} style={{ background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 10, padding: "8px 18px", fontSize: 12, color: "#c5cae9", cursor: "pointer" }}>🔗 Join a Classroom</button>
          }
        </div>
      )}

      {classrooms.length > 0 && (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: isMobile ? "column" : "row" }}>
          {isMobile ? (
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
              {classrooms.map(c => (
                <div key={c.id} onClick={() => setSelectedClassroom(c)} style={{
                  background: selectedClassroom?.id === c.id ? "#1a237e" : CL.card,
                  border: `0.5px solid ${selectedClassroom?.id === c.id ? CL.border : CL.line}`,
                  borderRadius: 20, padding: "6px 14px", cursor: "pointer", flexShrink: 0,
                  fontSize: 12, fontWeight: 600, color: selectedClassroom?.id === c.id ? "#c5cae9" : CL.muted,
                  whiteSpace: "nowrap", fontFamily: "Manrope,sans-serif",
                }}>{c.name}</div>
              ))}
            </div>
          ) : (
            <div style={{ width: 180, flexShrink: 0, display: "flex", flexDirection: "column", gap: 6 }}>
              {classrooms.map(classroomCard)}
            </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {selectedClassroom && (
              <>
                <div style={{ background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 14, padding: "12px 16px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: CL.text, fontFamily: "Syne,sans-serif" }}>{selectedClassroom.name}</div>
                      {teacherMode && (
                        <div style={{ fontSize: 10, color: CL.hint, marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                          ID: <code style={{ background: "#0a0c1e", padding: "1px 6px", borderRadius: 5, color: CL.muted }}>{selectedClassroom.id}</code>
                          <button onClick={() => navigator.clipboard.writeText(selectedClassroom.id)} style={{ background: "none", border: "none", color: CL.border, cursor: "pointer", fontSize: 10, padding: 0 }}>Copy</button>
                        </div>
                      )}
                    </div>
                    {selectedClassroom.exams?.length > 0 && (
                      <div style={{ background: "#1a0800", border: "0.5px solid #4a2000", borderRadius: 10, padding: "5px 10px", fontSize: 11, color: "#ffb74d" }}>
                        📅 {getDaysUntilExam(selectedClassroom.exams[0].examDate)}d until {selectedClassroom.exams[0].title}
                        <button onClick={() => { if (window.confirm("Start Exam Mode?")) window.dispatchEvent(new CustomEvent("startExamMode", { detail: selectedClassroom.exams[0] })); }} style={{ marginLeft: 8, background: "#ef4444", border: "none", borderRadius: 6, padding: "2px 8px", fontSize: 10, color: "#fff", cursor: "pointer" }}>Prep</button>
                      </div>
                    )}
                    {teacherMode && <button onClick={() => setShowExamModal(true)} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "5px 11px", fontSize: 11, color: CL.muted, cursor: "pointer" }}>📅 Add Exam</button>}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 10 }}>
                  <button onClick={() => goToTab("prev")} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: "50%", width: 28, height: 28, flexShrink: 0, color: CL.muted, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>‹</button>
                  <div ref={tabListRef} style={{ display: "flex", gap: 6, flex: 1, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}>
                    {TABS.map(t => (
                      <button key={t.id} onClick={() => setClassTab(t.id)} style={{
                        background: classTab === t.id ? "#1a237e" : CL.faint,
                        border: `0.5px solid ${classTab === t.id ? CL.border : CL.line}`,
                        borderRadius: 20, padding: "6px 13px", fontSize: 11,
                        color: classTab === t.id ? "#c5cae9" : CL.hint,
                        cursor: "pointer", fontFamily: "Manrope,sans-serif", fontWeight: 600,
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}>{t.label}</button>
                    ))}
                  </div>
                  <button onClick={() => goToTab("next")} style={{ background: CL.faint, border: `0.5px solid ${CL.line}`, borderRadius: "50%", width: 28, height: 28, flexShrink: 0, color: CL.muted, cursor: "pointer", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>›</button>
                </div>

                {classTab === "announcements" && (
                  <div>
                    {teacherMode && (
                      <div style={{ background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                        <input value={newAnnouncement.title} onChange={e => setNewAnnouncement(p => ({ ...p, title: e.target.value }))} placeholder="Announcement title" style={{ width: "100%", boxSizing: "border-box", background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "8px 12px", fontSize: 12, color: CL.text, outline: "none", marginBottom: 7 }} />
                        <textarea value={newAnnouncement.content} onChange={e => setNewAnnouncement(p => ({ ...p, content: e.target.value }))} placeholder="Announcement content…" rows={3} style={{ width: "100%", boxSizing: "border-box", background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "8px 12px", fontSize: 12, color: CL.muted, outline: "none", resize: "vertical", marginBottom: 7 }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: CL.muted, cursor: "pointer" }}>
                            <input type="checkbox" checked={newAnnouncement.isImportant} onChange={e => setNewAnnouncement(p => ({ ...p, isImportant: e.target.checked }))} />⚠️ Important
                          </label>
                          <button onClick={createAnnouncement} style={{ marginLeft: "auto", background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 9, padding: "6px 14px", fontSize: 11, color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Post</button>
                        </div>
                      </div>
                    )}
                    {(selectedClassroom.announcements || []).length === 0
                      ? <p style={{ fontSize: 12, color: CL.hint, padding: "16px 4px" }}>No announcements yet.</p>
                      : (selectedClassroom.announcements || []).map(a => (
                        <div key={a.id} style={{ background: a.isImportant ? "#140800" : CL.card, border: `0.5px solid ${a.isImportant ? "#4a2000" : CL.line}`, borderRadius: 12, padding: "11px 14px", marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: a.isImportant ? "#ffb74d" : CL.text, marginBottom: 4 }}>{a.isImportant ? "⚠️ " : ""}{a.title}</div>
                          <div style={{ fontSize: 12, color: CL.muted, lineHeight: 1.6 }}>{a.content}</div>
                          <div style={{ fontSize: 10, color: CL.hint, marginTop: 5 }}>{new Date(a.createdAt).toLocaleString()}</div>
                        </div>
                      ))
                    }
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
                        <div style={{ fontSize: 11, fontWeight: 700, color: CL.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 8, fontFamily: "Syne,sans-serif" }}>LEGACY ASSIGNMENTS</div>
                        {assignments.map(a => {
                          const subj = subjects.find(s => s.id === a.subjectId);
                          return (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 12, padding: "10px 14px", marginBottom: 7 }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: CL.text }}>{a.title}</div>
                                <div style={{ fontSize: 10, color: CL.hint }}>{subj?.label || ""}{a.due ? ` · Due ${a.due}` : ""}</div>
                              </div>
                              <button onClick={() => onComplete(a.id)} style={{ background: a.done ? "#071410" : "#1a237e", border: `0.5px solid ${a.done ? "#0a3020" : CL.border}`, borderRadius: 9, padding: "5px 12px", fontSize: 11, color: a.done ? "#81c784" : "#c5cae9", cursor: "pointer" }}>{a.done ? "✓ Done" : "Mark Done"}</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {classTab === "docs" && (
                  <div>
                    <div style={{ background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: CL.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10, fontFamily: "Syne,sans-serif" }}>QUICK LINKS</div>
                      {teacherMode && (
                        <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
                          <input value={newLinkTitle} onChange={e => setNewLinkTitle(e.target.value)} placeholder="Link name" style={{ flex: 1, minWidth: 100, background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "7px 11px", fontSize: 11, color: CL.text, outline: "none" }} />
                          <input value={newLinkUrl} onChange={e => setNewLinkUrl(e.target.value)} placeholder="https://…" style={{ flex: 2, minWidth: 140, background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 9, padding: "7px 11px", fontSize: 11, color: CL.text, outline: "none" }} />
                          <button onClick={addLink} style={{ background: "#1a237e", border: `0.5px solid ${CL.border}`, borderRadius: 9, padding: "7px 13px", fontSize: 11, color: "#c5cae9", cursor: "pointer" }}>Add</button>
                        </div>
                      )}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                        {(selectedClassroom.links || []).map(link => (
                          <button key={link.id} onClick={() => setPopupLink(link)} style={{ background: "#0a0c1e", border: `0.5px solid #2a2d6a`, borderRadius: 20, padding: "6px 13px", fontSize: 11, color: "#9fa8da", cursor: "pointer" }}>🔗 {link.title}</button>
                        ))}
                        {!(selectedClassroom.links?.length) && <span style={{ fontSize: 12, color: CL.hint }}>No links yet.</span>}
                      </div>
                    </div>
                    <div style={{ background: CL.card, border: `0.5px solid ${CL.line}`, borderRadius: 14, padding: "12px 14px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: CL.border, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 10, fontFamily: "Syne,sans-serif" }}>DOCUMENTS</div>
                      {teacherMode && (
                        <div style={{ marginBottom: 10 }}>
                          <input type="file" accept=".pdf,.docx,.doc,.txt" onChange={uploadDocument} disabled={uploadingDoc} style={{ fontSize: 11 }} />
                          {uploadingDoc && <span style={{ fontSize: 11, color: CL.muted, marginLeft: 8 }}>Uploading…</span>}
                        </div>
                      )}
                      {(selectedClassroom.documents || []).map(doc => (
                        <div key={doc.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#0a0c1e", border: `0.5px solid ${CL.line}`, borderRadius: 11, padding: "9px 12px", marginBottom: 7 }}>
                          <span style={{ fontSize: 18 }}>{doc.fileType === "pdf" ? "📕" : doc.fileType === "docx" ? "📘" : "📄"}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: CL.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.title}</div>
                            <div style={{ fontSize: 10, color: CL.hint }}>{doc.fileType?.toUpperCase()} · {(doc.fileSize / 1024).toFixed(1)} KB</div>
                          </div>
                          <button onClick={async () => {
                            try {
                              const res = await fetch(`${API_BASE}/classroom/documents/${doc.id}/download`, { headers: { Authorization: `Bearer ${token}` } });
                              if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Download failed"); }
                              const blob = await res.blob(); const url = URL.createObjectURL(blob);
                              const link = document.createElement("a"); link.href = url; link.download = doc.filename || doc.title || "document";
                              document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
                            } catch (err) { toast.error("Download failed: " + err.message); }
                          }} style={{ background: "#071410", border: "0.5px solid #0a3020", borderRadius: 8, padding: "5px 10px", fontSize: 10, color: "#81c784", cursor: "pointer" }}>⬇️ Download</button>
                        </div>
                      ))}
                      {!(selectedClassroom.documents?.length) && <span style={{ fontSize: 12, color: CL.hint }}>No documents yet.</span>}
                    </div>
                  </div>
                )}

                {classTab === "attendance" && (
                  <AttendancePanel classroomId={selectedClassroom.id} isHost={isHost} token={token} />
                )}

                {teacherMode && (
                  <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                    <BulkImport onImportQuestions={onImportQuestions} />
                    <AIQuestionGen onImportQuestions={onImportQuestions} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {showCreateClass && (
        <div className="modal-overlay" onClick={() => setShowCreateClass(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>Create New Classroom</h3>
            <input value={newClassName} onChange={(e) => setNewClassName(e.target.value)} placeholder="Classroom name (e.g., 'MTH111 - 2024')" style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ width: "100%", boxSizing: "border-box", marginBottom: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14 }}>
              <option value="">Select Subject (optional)</option>
              {subjects.map((s) => (<option key={s.id} value={s.id}>{s.label}</option>))}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCreateClass(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={createClassroom} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#1a237e", color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {showJoinClass && (
        <div className="modal-overlay" onClick={() => { setShowJoinClass(false); setJoinError(""); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>🔗 Join Classroom</h3>
            <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>Enter the Classroom ID provided by your teacher.</p>
            <input value={joinClassCode} onChange={(e) => setJoinClassCode(e.target.value)} placeholder="Classroom ID (e.g., 'abc123')" style={{ width: "100%", boxSizing: "border-box", marginBottom: 8, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            {joinError && <p style={{ color: "#ef4444", fontSize: 12, marginBottom: 8 }}>{joinError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setShowJoinClass(false); setJoinError(""); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={joinClassroom} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#1a237e", color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Join</button>
            </div>
          </div>
        </div>
      )}

      {popupLink && (
        <div className="modal-overlay" onClick={() => setPopupLink(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400, padding: 20 }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 16 }}>🔗 {popupLink.title}</h3>
            <p style={{ wordBreak: "break-all", color: "#a5b4fc", marginBottom: 16, fontSize: 13 }}>{popupLink.url}</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setPopupLink(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Close</button>
              <button onClick={() => { window.open(popupLink.url, "_blank"); setPopupLink(null); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Open Link</button>
            </div>
          </div>
        </div>
      )}

      {showAnnouncementPopup && (
        <div className="modal-overlay" onClick={() => { markAnnouncementRead(showAnnouncementPopup.id); setShowAnnouncementPopup(null); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, padding: 20, border: "2px solid rgba(239,68,68,0.5)", background: "linear-gradient(135deg, rgba(30,41,59,0.95), rgba(239,68,68,0.1))" }}>
            <div style={{ textAlign: "center", marginBottom: 14 }}>
              <span style={{ fontSize: 40 }}>⚠️</span>
              <h3 style={{ color: "#fbbf24", margin: "4px 0 0 0" }}>Important Announcement</h3>
            </div>
            <h4 style={{ margin: "0 0 8px 0" }}>{showAnnouncementPopup.title}</h4>
            <p style={{ marginBottom: 14, fontSize: 14, lineHeight: 1.6 }}>{showAnnouncementPopup.content}</p>
            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>Posted: {new Date(showAnnouncementPopup.createdAt).toLocaleString()}</div>
            <button onClick={() => { markAnnouncementRead(showAnnouncementPopup.id); setShowAnnouncementPopup(null); }} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(239,68,68,0.2)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Got it!</button>
          </div>
        </div>
      )}

      {showExamModal && (
        <div className="modal-overlay" onClick={() => setShowExamModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 20 }}>
            <h3 style={{ margin: "0 0 14px 0", fontSize: 16 }}>📅 Add Exam</h3>
            <input value={newExam.title} onChange={(e) => setNewExam((prev) => ({ ...prev, title: e.target.value }))} placeholder="Exam title (e.g., 'MTH111 Mid-Semester')" style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            <input type="datetime-local" value={newExam.examDate} onChange={(e) => setNewExam((prev) => ({ ...prev, examDate: e.target.value }))} style={{ width: "100%", boxSizing: "border-box", marginBottom: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            <input type="number" value={newExam.duration} onChange={(e) => setNewExam((prev) => ({ ...prev, duration: parseInt(e.target.value) }))} placeholder="Duration (minutes)" style={{ width: "100%", boxSizing: "border-box", marginBottom: 14, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.3)", color: "#fff", fontSize: 14, outline: "none" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowExamModal(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#fff", cursor: "pointer", fontWeight: 600 }}>Cancel</button>
              <button onClick={createExam} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: "#1a237e", color: "#c5cae9", cursor: "pointer", fontWeight: 600 }}>Add Exam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Classroom;
