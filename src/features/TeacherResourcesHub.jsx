import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, formatViewCount } from "../lib/researchUtils";
import { getDepartments } from "../lib/departments.js";
import { getMyProfile } from "../lib/profileApi.js";
import { listFolders, createFolder, getFolder, deleteFolder as apiDeleteFolder, getPendingResources } from "../lib/foldersApi";
import ResourceViewer from "./ResourceViewer";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";

export default function TeacherResourcesHub({ onBack } = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const lastFetchKey = useRef("");
  const [resources, setResources] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allMaterialsLoading, setAllMaterialsLoading] = useState(false);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [toast, setToast] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [activeTab, setActiveTab] = useState("my");
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filters, setFilters] = useState({ university: "all", department: "all", level: "all", semester: "all", subject: "all" });
  const [departments, setDepartments] = useState([]);
  const [userProfile, setUserProfile] = useState(null);
  const [editResource, setEditResource] = useState(null);
  const [editForm, setEditForm] = useState({ title: "", subject: "", description: "", isPremium: false, level: "", semester: "" });
  const [editDeptIds, setEditDeptIds] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editingMcq, setEditingMcq] = useState(null);
  const [mcqDrafts, setMcqDrafts] = useState([]);
  const [mcqSaving, setMcqSaving] = useState(false);
  const levels = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level", "600 Level"];
  const semesters = ["First Semester", "Second Semester"];

  // Folder state
  const [folders, setFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderDetail, setFolderDetail] = useState(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [folderPending, setFolderPending] = useState([]);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCourseCode, setNewFolderCourseCode] = useState("");
  const [newFolderDeptIds, setNewFolderDeptIds] = useState([]);
  const [newFolderVisibility, setNewFolderVisibility] = useState("shared");
  const [newFolderLevel, setNewFolderLevel] = useState("");
  const [newFolderSemester, setNewFolderSemester] = useState("");
  const [activeFolderTab, setActiveFolderTab] = useState("materials");
  const [groupByUniversity, setGroupByUniversity] = useState(true);
  const [collapsedUnis, setCollapsedUnis] = useState({});

  useEffect(() => {
    // Re-fetch when location key changes (e.g., navigating back from upload)
    if (lastFetchKey.current === location.key) return;
    lastFetchKey.current = location.key;
    fetchMyResources();
    fetchFolders();
    fetchUserProfile();
  }, [location.key]);

  useEffect(() => {
    if (userProfile?.universityId) {
      getDepartments(userProfile.universityId).then(setDepartments).catch(() => {});
    } else {
      getDepartments().then(setDepartments).catch(() => {});
    }
  }, [userProfile?.universityId]);

  const fetchUserProfile = async () => {
    try {
      const data = await getMyProfile();
      if (data?.profile) setUserProfile(data.profile);
    } catch {}
  };

  useEffect(() => {
    if (activeTab === "all" && allMaterials.length === 0 && !allMaterialsLoading) {
      fetchAllMaterials();
    }
  }, [activeTab]);

  const getAuthHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}` };
  };

  const fetchMyResources = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/resources/teacher/my`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setResources(data);
      } else {
        setError("Failed to fetch resources");
      }
    } catch {
      setError("Failed to fetch resources");
    } finally {
      setLoading(false);
    }
  };

  const fetchAllMaterials = async () => {
    setAllMaterialsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/resources/all`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setAllMaterials(data);
      } else {
        setError("Failed to fetch all materials");
      }
    } catch {
      setError("Failed to fetch all materials");
    } finally {
      setAllMaterialsLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const data = await listFolders();
      setFolders(data.own || []);
    } catch {}
  };

  const fetchFolderDetail = async (folderId) => {
    setFolderLoading(true);
    try {
      const data = await getFolder(folderId);
      setFolderDetail(data);
    } catch {
      showToast("Failed to load folder");
    } finally {
      setFolderLoading(false);
    }
  };

  const fetchFolderPending = async (folderId) => {
    try {
      const data = await getPendingResources(folderId);
      setFolderPending(data);
    } catch {
      setFolderPending([]);
    }
  };

  const openFolder = (folderId) => {
    setActiveFolder(folderId);
    setFolderDetail(null);
    setFolderPending([]);
    setActiveFolderTab("materials");
    fetchFolderDetail(folderId);
    fetchFolderPending(folderId);
  };

  const closeFolder = () => {
    setActiveFolder(null);
    setFolderDetail(null);
    setFolderPending([]);
    setActiveFolderTab("materials");
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { showToast("Folder name required"); return; }
    try {
      const data = await createFolder({
        name: newFolderName.trim(),
        courseCode: newFolderCourseCode.trim() || null,
        visibility: newFolderVisibility,
        departmentIds: newFolderDeptIds,
        level: newFolderLevel || null,
        semester: newFolderSemester || null,
        universityId: userProfile?.universityId || null,
      });
      setFolders((prev) => [data, ...prev]);
      setShowCreateFolder(false);
      setNewFolderName("");
      setNewFolderCourseCode("");
      setNewFolderDeptIds([]);
      setNewFolderVisibility("shared");
      setNewFolderLevel("");
      setNewFolderSemester("");
      showToast("Folder created ✓");
    } catch (err) {
      showToast(err.message || "Failed to create folder");
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!confirm("Delete this folder? Resources inside will remain but lose folder association.")) return;
    try {
      await apiDeleteFolder(folderId);
      setFolders((prev) => prev.filter((f) => f.id !== folderId));
      if (activeFolder === folderId) closeFolder();
      showToast("Folder deleted");
    } catch {
      showToast("Failed to delete folder");
    }
  };

  const handleApproveFolderItem = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${id}/approve`, { method: "PATCH", headers: getAuthHeaders() });
      if (response.ok) {
        setFolderPending((prev) => prev.filter((r) => r.id !== id));
        if (activeFolder) fetchFolderDetail(activeFolder);
        showToast("Resource approved ✓");
      } else {
        showToast("Failed to approve");
      }
    } catch {
      showToast("Failed to approve");
    }
  };

  const handleRejectFolderItem = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${id}/reject`, { method: "PATCH", headers: getAuthHeaders() });
      if (response.ok) {
        setFolderPending((prev) => prev.filter((r) => r.id !== id));
        showToast("Resource rejected");
      } else {
        showToast("Failed to reject");
      }
    } catch {
      showToast("Failed to reject");
    }
  };

  const handleApprove = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${id}/approve`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setAllMaterials((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
        showToast("Resource approved ✓");
      } else {
        showToast("Failed to approve resource");
      }
    } catch {
      showToast("Failed to approve resource");
    }
  };

  const handleReject = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${id}/reject`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setAllMaterials((prev) => prev.map((r) => (r.id === id ? { ...r, status: "rejected" } : r)));
        showToast("Resource disapproved — now visible only to uploader");
      } else {
        showToast("Failed to disapprove resource");
      }
    } catch {
      showToast("Failed to disapprove resource");
    }
  };

  const handleDelete = async (id) => {
    try {
      const response = await fetch(`${API_BASE}/api/resources/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        setResources((prev) => prev.filter((r) => r.id !== id));
        setAllMaterials((prev) => prev.filter((r) => r.id !== id));
        setDeleteConfirm(null);
        showToast("Resource deleted");
      } else {
        const data = await response.json().catch(() => ({}));
        setError(data.error || "Failed to delete resource");
      }
    } catch {
      setError("Failed to delete resource");
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const openEdit = (resource) => {
    setEditResource(resource);
    setEditForm({
      title: resource.title || "",
      subject: resource.subject || "",
      description: resource.description || "",
      isPremium: resource.isPremium || false,
      level: resource.level || "",
      semester: resource.semester || "",
    });
    setEditDeptIds(resource.resourceDepts ? resource.resourceDepts.map((rd) => rd.departmentId) : []);
  };

  const submitEdit = async () => {
    if (!editResource) return;
    setEditSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/${editResource.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          subject: editForm.subject,
          description: editForm.description,
          isPremium: editForm.isPremium,
          level: editForm.level,
          semester: editForm.semester,
          departmentIds: editDeptIds,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setAllMaterials((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setEditResource(null);
        showToast("Resource updated ✓");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Update failed");
      }
    } catch {
      showToast("Update failed — check connection");
    }
    setEditSaving(false);
  };

  const openMcqEditor = (resource) => {
    let mcqs = resource.mcqData;
    if (typeof mcqs === "string") {
      try { mcqs = JSON.parse(mcqs); } catch { mcqs = []; }
    }
    if (!Array.isArray(mcqs)) mcqs = [];
    setMcqDrafts(mcqs.map((q) => ({
      question: q.question || "",
      options: q.options || { A: "", B: "", C: "", D: "" },
      correct: q.correct || "A",
      explanation: q.explanation || "",
    })));
    setEditingMcq(resource);
  };

  const saveMcq = async () => {
    if (!editingMcq) return;
    if (mcqDrafts.length === 0) {
      showToast("At least one question is required");
      return;
    }
    setMcqSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/resources/${editingMcq.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ mcqData: mcqDrafts }),
      });
      if (res.ok) {
        const updated = await res.json();
        setResources((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setAllMaterials((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setEditingMcq(null);
        showToast("Questions updated ✓");
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "Update failed");
      }
    } catch {
      showToast("Update failed — check connection");
    }
    setMcqSaving(false);
  };

  const activeFilterCount = ["university", "level", "semester", "subject"].filter((k) => filters[k] !== "all").length;

  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const matchesUni = filters.university === "all" || r.university?.name === filters.university;
      const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
      const matchesLevel = filters.level === "all" || r.level === filters.level;
      const matchesSemester = filters.semester === "all" || r.semester === filters.semester;
      const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
      return matchesUni && matchesDept && matchesLevel && matchesSemester && matchesSubject;
    });
  }, [resources, filters]);

  const groupedByUniversity = useMemo(() => {
    const groups = {};
    for (const r of filteredResources) {
      const uniName = r.university?.name || "Unassigned";
      if (!groups[uniName]) groups[uniName] = [];
      groups[uniName].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "Unassigned") return 1;
      if (b === "Unassigned") return -1;
      return a.localeCompare(b);
    });
  }, [filteredResources]);

  const filteredAllMaterials = useMemo(() => {
    return allMaterials.filter((r) => {
      const matchesUni = filters.university === "all" || r.university?.name === filters.university;
      const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
      const matchesLevel = filters.level === "all" || r.level === filters.level;
      const matchesSemester = filters.semester === "all" || r.semester === filters.semester;
      const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
      return matchesUni && matchesDept && matchesLevel && matchesSemester && matchesSubject;
    });
  }, [allMaterials, filters]);

  const allResources = useMemo(() => [...resources, ...allMaterials], [resources, allMaterials]);

  const filterOptions = useMemo(() => {
    const keys = ["level", "semester", "subject"];
    const result = {};
    for (const key of keys) {
      const set = new Set(allResources.map((r) => r[key]).filter(Boolean));
      result[key] = Array.from(set).sort();
    }
    const deptSet = new Set();
    const uniSet = new Set();
    for (const r of allResources) {
      if (r.department) deptSet.add(r.department);
      if (r.resourceDepts) r.resourceDepts.forEach((rd) => deptSet.add(rd.department.name));
      if (r.university?.name) uniSet.add(r.university.name);
    }
    result.department = Array.from(deptSet).sort();
    result.university = Array.from(uniSet).sort();
    return result;
  }, [allResources]);

  const folderCategorized = useMemo(() => {
    if (!folderDetail) return { materials: [], summaries: [], flashcards: [], mcqs: [] };
    const all = [...(folderDetail.sharedResources || []), ...(folderDetail.myResources || [])];
    const materials = [], summaries = [], flashcards = [], mcqs = [];
    for (const r of all) {
      if (r.contentType === "mcq") mcqs.push(r);
      else if (r.contentType === "flashcard_deck") flashcards.push(r);
      else if (r.title?.startsWith("[AI] Summary")) summaries.push(r);
      else materials.push(r);
    }
    return { materials, summaries, flashcards, mcqs };
  }, [folderDetail]);

  const renderResourceRow = (resource, showApproveReject = false) => {
    const badgeColor = getSubjectBadgeColor(resource.subject);
    const icon = getContentTypeIcon(resource.contentType);
    const iconClass = getContentTypeIconClass(resource.contentType);

    return (
      <div key={resource.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px", background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px" }}>
        <div style={{
          width: "36px", height: "36px", borderRadius: "8px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px", flexShrink: 0,
          background: iconClass === "icon-pdf" ? "#2a0a0a" : iconClass === "icon-mcq" ? "#0f1440" : iconClass === "icon-note" ? "#0f2a1a" : "#1a1000",
          border: iconClass === "icon-pdf" ? "0.5px solid #4a1010" : iconClass === "icon-mcq" ? "0.5px solid #2a3080" : iconClass === "icon-note" ? "0.5px solid #1a4a2a" : "0.5px solid #3a2800",
        }}>{icon}</div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: "#c5c9e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: "2px" }}>
            {resource.title}
          </div>
          <div style={{ fontSize: "11px", color: "#4a5080", display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ padding: "2px 6px", borderRadius: "6px", background: badgeColor.bg, color: badgeColor.text, border: `0.5px solid ${badgeColor.border}` }}>{resource.subject}</span>
            <span>·</span>
            <span>{formatViewCount(resource.viewCount)} views</span>
            {resource.isPremium && <span>· ⭐ Premium</span>}
            {resource.uploader && <span>· by {resource.uploader.username}</span>}
            {resource.university?.name && <span>· 🎓 {resource.university.name}</span>}
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
          {showApproveReject ? (
            <>
              {resource.status === "rejected" ? (
                <button onClick={() => handleApprove(resource.id)} title="Re-approve" style={{
                  width: "32px", height: "32px", background: "#0f2a1a", border: "0.5px solid #2a6a3a", borderRadius: "7px",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#66bb6a", fontSize: "14px",
                }}>✓</button>
              ) : (
                <button onClick={() => handleReject(resource.id)} title="Disapprove" style={{
                  width: "32px", height: "32px", background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "7px",
                  display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ef9a9a", fontSize: "14px",
                }}>✗</button>
              )}
              {resource.status === "rejected" && (
                <span style={{ fontSize: "10px", color: "#ef9a9a", padding: "4px 8px", background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "6px", whiteSpace: "nowrap" }}>
                  Disapproved
                </span>
              )}
            </>
          ) : (
            <button onClick={() => setViewerToken(resource.shareToken)} title="View" style={{
              width: "32px", height: "32px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "7px",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5a6090", fontSize: "13px",
            }}>👁️</button>
          )}
          {resource.contentType === "mcq" && (
            <button onClick={() => openMcqEditor(resource)} title="Edit Questions" style={{
              width: "32px", height: "32px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "7px",
              display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5a6090", fontSize: "13px",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#0f1440"; e.currentTarget.style.borderColor = "#2a3080"; e.currentTarget.style.color = "#DAA520"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#111328"; e.currentTarget.style.borderColor = "#2a2d4a"; e.currentTarget.style.color = "#5a6090"; }}
            >📝</button>
          )}
          <button onClick={() => openEdit(resource)} title="Edit" style={{
            width: "32px", height: "32px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "7px",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5a6090", fontSize: "13px",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#0f1440"; e.currentTarget.style.borderColor = "#2a3080"; e.currentTarget.style.color = "#DAA520"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#111328"; e.currentTarget.style.borderColor = "#2a2d4a"; e.currentTarget.style.color = "#5a6090"; }}
          >✏️</button>
          <button onClick={() => setDeleteConfirm(resource.id)} title="Delete" style={{
            width: "32px", height: "32px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "7px",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5a6090", fontSize: "13px",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#2a0a0a"; e.currentTarget.style.borderColor = "#4a1010"; e.currentTarget.style.color = "#ef9a9a"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#111328"; e.currentTarget.style.borderColor = "#2a2d4a"; e.currentTarget.style.color = "#5a6090"; }}
          >🗑️</button>
        </div>
      </div>
    );
  };

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} onBack={() => setViewerToken(null)} />;
  }

  if (activeTab === "folders" && activeFolder) {
    const folderSubTabs = [
      ["materials", "📄 Materials", folderCategorized.materials.length],
      ["summary", "📝 Summary", folderCategorized.summaries.length],
      ["flashcards", "🎴 Flash Cards", folderCategorized.flashcards.length],
      ["mcqs", "✎ MCQs", folderCategorized.mcqs.length],
    ];
    const currentList = folderCategorized[activeFolderTab] || [];
    const tabBtnStyle = (active) => ({
      padding: "8px 16px", borderRadius: "10px", border: "none", fontSize: "13px", fontWeight: 700, cursor: "pointer",
      background: active ? "#1a1a1a" : "none", color: active ? "#FFD700" : "#4a5080", display: "flex", alignItems: "center", gap: "6px", whiteSpace: "nowrap",
    });

    return (
      <div style={{ padding: "20px", maxWidth: "1200px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
          <button onClick={closeFolder} style={{ padding: "8px 14px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "13px", color: "#7b82b8", cursor: "pointer" }}>← Folders</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#e8eaf6" }}>{folderDetail?.name || "Loading…"}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
              {folderDetail?.courseCode && <span style={{ fontSize: 11, color: "#7b82b8" }}>{folderDetail.courseCode}</span>}
              {folderDetail?.level && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "8px", background: "#0f1440", color: "#DAA520", border: "0.5px solid #2a3080" }}>{folderDetail.level}</span>}
              {folderDetail?.semester && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "8px", background: "#0f2a1a", color: "#a5d6a7", border: "0.5px solid #2a6a3a" }}>{folderDetail.semester}</span>}
            </div>
          </div>
          {folderDetail && (
            <button onClick={() => handleDeleteFolder(folderDetail.id)} style={{ padding: "8px 12px", background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "8px", fontSize: 13, color: "#ef9a9a", cursor: "pointer" }}>🗑 Delete</button>
          )}
        </div>

        {/* Pending contributions */}
        {folderPending.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#ffcc80", marginBottom: 10 }}>⏳ Pending Contributions ({folderPending.length})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {folderPending.map((r) => (
                <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "#1a1000", border: "0.5px solid #3a2800", borderRadius: "10px" }}>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#c5c9e8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: "#7b82b8" }}>{r.contentType} · by {r.uploader?.username || "Unknown"}</div>
                  </div>
                  <button onClick={() => handleApproveFolderItem(r.id)} style={{ width: 32, height: 32, background: "#0f2a1a", border: "0.5px solid #2a6a3a", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#66bb6a", fontSize: 14 }}>✓</button>
                  <button onClick={() => handleRejectFolderItem(r.id)} style={{ width: 32, height: 32, background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "7px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ef9a9a", fontSize: 14 }}>✗</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sub-tab row */}
        <div style={{ display: "flex", gap: "6px", marginBottom: 16, overflowX: "auto", paddingBottom: "4px" }}>
          {folderSubTabs.map(([key, label, count]) => (
            <button key={key} onClick={() => setActiveFolderTab(key)} style={tabBtnStyle(activeFolderTab === key)}>
              {label}
              {count > 0 && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: "999px", fontSize: "10px", padding: "1px 6px" }}>{count}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        {folderLoading ? (
          <div style={{ color: "#7b82b8", padding: 40, textAlign: "center" }}>Loading folder contents…</div>
        ) : currentList.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {currentList.map((r) => renderResourceRow(r, false))}
          </div>
        ) : (
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "40px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>
              {activeFolderTab === "materials" ? "📄" : activeFolderTab === "summary" ? "📝" : activeFolderTab === "flashcards" ? "🎴" : "✎"}
            </div>
            <div style={{ fontSize: 14, color: "#7b82b8" }}>
              {activeFolderTab === "materials" && "No materials in this folder yet."}
              {activeFolderTab === "summary" && "No AI-generated summaries yet."}
              {activeFolderTab === "flashcards" && "No flashcard decks in this folder yet."}
              {activeFolderTab === "mcqs" && "No MCQ sets in this folder yet."}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "1000px", margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>Teacher Hub</h1>
          <p style={{ fontSize: "14px", color: "#7b82b8" }}>Manage your uploaded resources</p>
        </div>
        <button onClick={() => navigate("/teacher/resources/upload")} style={{
          padding: "10px 20px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#FFD700", cursor: "pointer",
        }}>+ Upload New</button>
      </div>

      {/* Tabs + Filter */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "14px", alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("my")} style={activeTab === "my" ? tabActiveStyle : tabStyle}>
          My Uploads ({filteredResources.length})
        </button>
        <button onClick={() => setActiveTab("folders")} style={activeTab === "folders" ? tabActiveStyle : tabStyle}>
          📁 Folders ({folders.length})
        </button>
        <button onClick={() => setActiveTab("all")} style={activeTab === "all" ? tabActiveStyle : tabStyle}>
          📚 All Materials ({filteredAllMaterials.length})
        </button>
        <button onClick={() => setShowFilterSheet(true)} style={{
          ...filterBtnStyle,
          background: activeFilterCount > 0 ? "#1a1a1a" : "#0f1128",
          border: activeFilterCount > 0 ? "0.5px solid #B8860B" : "0.5px solid #1e2245",
          color: activeFilterCount > 0 ? "#FFD700" : "#DAA520",
        }}>
          <span>🔧 Filters</span>
          {activeFilterCount > 0 && <span style={{ background: "rgba(255,255,255,0.15)", borderRadius: "999px", fontSize: "10px", padding: "1px 6px" }}>{activeFilterCount}</span>}
        </button>
      </div>

      {/* Department Tabs */}
      <div style={{ display: "flex", gap: "6px", overflowX: "auto", marginBottom: "20px", paddingBottom: "4px" }}>
        <button
          onClick={() => setFilters((p) => ({ ...p, department: "all" }))}
          style={{
            padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
            background: filters.department === "all" ? "#1a1a1a" : "#0f1128",
            border: filters.department === "all" ? "0.5px solid #B8860B" : "0.5px solid #1e2245",
            color: filters.department === "all" ? "#FFD700" : "#7b82b8",
          }}
        >
          All
        </button>
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => setFilters((p) => ({ ...p, department: d.name }))}
            style={{
              padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer",
              background: filters.department === d.name ? "#1a1a1a" : "#0f1128",
              border: filters.department === d.name ? "0.5px solid #B8860B" : "0.5px solid #1e2245",
              color: filters.department === d.name ? "#FFD700" : "#7b82b8",
            }}
          >
            {d.icon || "🏛️"} {d.name}
          </button>
        ))}
      </div>

      {/* My Uploads Tab */}
      {activeTab === "my" && (
        <>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "14px", height: "70px" }} />)}
            </div>
          ) : filteredResources.length === 0 ? (
            <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "14px", color: "#7b82b8" }}>{activeFilterCount > 0 ? "No resources match your filters" : "No resources uploaded yet"}</div>
            </div>
          ) : (
            <>
              {/* Group toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                <button
                  onClick={() => setGroupByUniversity((v) => !v)}
                  style={{
                    padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                    background: groupByUniversity ? "#1a1a1a" : "#0f1128",
                    border: groupByUniversity ? "0.5px solid #B8860B" : "0.5px solid #1e2245",
                    color: groupByUniversity ? "#FFD700" : "#7b82b8",
                  }}
                >
                  🎓 Group by University
                </button>
                <span style={{ fontSize: "12px", color: "#4a5080" }}>{filteredResources.length} resource{filteredResources.length !== 1 ? "s" : ""}</span>
              </div>

              {groupByUniversity ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {groupedByUniversity.map(([uniName, uniResources]) => {
                    const isCollapsed = collapsedUnis[uniName];
                    return (
                      <div key={uniName} style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "12px", overflow: "hidden" }}>
                        <div
                          onClick={() => setCollapsedUnis((p) => ({ ...p, [uniName]: !p[uniName] }))}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px",
                            cursor: "pointer", userSelect: "none",
                            background: uniName === "Unassigned" ? "#0d0f20" : "#0f1028",
                            borderBottom: isCollapsed ? "none" : "0.5px solid #1e2245",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "16px" }}>{isCollapsed ? "▶" : "▼"}</span>
                            <span style={{ fontSize: "14px", fontWeight: 700, color: uniName === "Unassigned" ? "#7b82b8" : "#DAA520" }}>
                              {uniName === "Unassigned" ? "📋 Unassigned" : `🎓 ${uniName}`}
                            </span>
                          </div>
                          <span style={{ fontSize: "12px", color: "#4a5080", background: "#0d0f20", padding: "2px 10px", borderRadius: "999px", border: "0.5px solid #1e2245" }}>
                            {uniResources.length}
                          </span>
                        </div>
                        {!isCollapsed && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "12px" }}>
                            {uniResources.map((r) => renderResourceRow(r, false))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {filteredResources.map((r) => renderResourceRow(r, false))}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Folders Tab */}
      {activeTab === "folders" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 14, color: "#7b82b8" }}>Create shared folders for your departments. Students can contribute materials for your approval.</div>
              <button onClick={() => setShowCreateFolder(true)} style={{ padding: "10px 20px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "8px", fontSize: 14, fontWeight: 600, color: "#FFD700", cursor: "pointer", flexShrink: 0 }}>+ New folder</button>
            </div>

            {folders.length === 0 ? (
              <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "40px", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📁</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#7b82b8", marginBottom: 6 }}>No folders yet</div>
                <div style={{ fontSize: 13, color: "#4a5080", maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
                  Create shared folders to organize materials by course or department. Students can upload into your folders for approval.
                </div>
                <button onClick={() => setShowCreateFolder(true)} style={{ marginTop: 16, padding: "10px 20px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "8px", fontSize: 14, fontWeight: 600, color: "#FFD700", cursor: "pointer" }}>+ Create your first folder</button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "14px" }}>
                {folders.map((folder) => (
                  <div key={folder.id} style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "16px", cursor: "pointer", transition: "borderColor 0.15s" }}
                    onClick={() => openFolder(folder.id)}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#B8860B")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1e2245")}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>📁</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#c5c9e8", marginBottom: 4 }}>{folder.name}</div>
                    {folder.courseCode && <div style={{ fontSize: 11, color: "#7b82b8", marginBottom: 6 }}>{folder.courseCode}</div>}
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
                      {folder.level && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "8px", background: "#0f1440", color: "#DAA520", border: "0.5px solid #2a3080" }}>{folder.level}</span>}
                      {folder.semester && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "8px", background: "#0f2a1a", color: "#a5d6a7", border: "0.5px solid #2a6a3a" }}>{folder.semester}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: "8px", background: folder.visibility === "private" ? "#1a0808" : "#0f2a1a", color: folder.visibility === "private" ? "#ef9a9a" : "#a5d6a7", border: `0.5px solid ${folder.visibility === "private" ? "#4a1010" : "#2a6a3a"}` }}>
                        {folder.visibility === "private" ? "🔒 Private" : folder.visibility === "link" ? "🔗 Link" : "👥 Shared"}
                      </span>
                      {folder._count?.resources > 0 && <span style={{ fontSize: 10, color: "#4a5080" }}>{folder._count.resources} items</span>}
                    </div>
                    {folder.folderDepts && folder.folderDepts.length > 0 && (
                      <div style={{ fontSize: 10, color: "#4a5080", marginTop: 6 }}>
                        {folder.folderDepts.map((fd) => fd.department?.name || fd.departmentId).join(", ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
      )}

      {/* All Materials Tab */}
      {activeTab === "all" && (
        <>
          {allMaterialsLoading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map((i) => <div key={i} style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "14px", height: "70px" }} />)}
            </div>
          ) : filteredAllMaterials.length === 0 ? (
            <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "40px", textAlign: "center" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px" }}>📚</div>
              <div style={{ fontSize: "14px", color: "#7b82b8" }}>{activeFilterCount > 0 ? "No materials match your filters" : "No materials found"}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredAllMaterials.map((r) => renderResourceRow(r, true))}
            </div>
          )}
        </>
      )}

      {/* Filter Sheet */}
      {showFilterSheet && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowFilterSheet(false)}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #2a2d4a", borderRadius: "18px", padding: "26px", width: "90%", maxWidth: "420px", maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#e8eaf6", margin: 0 }}>Filters</h2>
              <button onClick={() => setShowFilterSheet(false)} style={{ background: "none", border: "none", color: "#4a5080", fontSize: "16px", cursor: "pointer", padding: "4px" }}>✕</button>
            </div>

            {[
              { key: "university", label: "University" },
              { key: "level", label: "Level" },
              { key: "semester", label: "Semester" },
              { key: "subject", label: "Subject" },
            ].map(({ key, label }) => {
              const options = filterOptions[key] || [];
              return (
                <div key={key} style={{ marginBottom: "14px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>{label}</label>
                  <select
                    value={filters[key]}
                    onChange={(e) => setFilters((p) => ({ ...p, [key]: e.target.value }))}
                    style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }}
                  >
                    <option value="all">All {label.toLowerCase()}s</option>
                    {options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              );
            })}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setFilters({ university: "all", department: "all", level: "all", semester: "all", subject: "all" })}
                style={{ flex: 1, padding: "10px", background: "#0f1128", border: "0.5px solid #252860", borderRadius: "10px", fontSize: "13px", fontWeight: 600, color: "#7986cb", cursor: "pointer" }}
              >
                Clear all{activeFilterCount > 0 && ` (${activeFilterCount})`}
              </button>
              <button
                onClick={() => setShowFilterSheet(false)}
                style={{ flex: 1, padding: "10px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "10px", fontSize: "13px", fontWeight: 700, color: "#FFD700", cursor: "pointer" }}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ background: "#1a0808", border: "0.5px solid #4a1010", borderRadius: "8px", padding: "12px", fontSize: "13px", color: "#ef9a9a", marginTop: "16px" }}>{error}</div>
      )}

      {/* Edit Resource Modal */}
      {editResource && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => !editSaving && setEditResource(null)}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #2a2d4a", borderRadius: "18px", padding: "26px", width: "90%", maxWidth: "480px", maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#e8eaf6", margin: 0 }}>Edit Resource</h2>
              <button onClick={() => setEditResource(null)} style={{ background: "none", border: "none", color: "#4a5080", fontSize: "16px", cursor: "pointer", padding: "4px" }}>✕</button>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Title</label>
              <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }} />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Subject</label>
              <input value={editForm.subject} onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))} style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }} />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Description</label>
              <textarea value={editForm.description} onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))} rows={3} style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none", resize: "vertical" }} />
            </div>

            <div style={{ display: "flex", gap: "10px", marginBottom: "14px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Level</label>
                <select value={editForm.level} onChange={(e) => setEditForm((p) => ({ ...p, level: e.target.value }))} style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }}>
                  <option value="">None</option>
                  {levels.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Semester</label>
                <select value={editForm.semester} onChange={(e) => setEditForm((p) => ({ ...p, semester: e.target.value }))} style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }}>
                  <option value="">None</option>
                  {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "6px", display: "block" }}>Departments</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {departments.map((d) => {
                  const selected = editDeptIds.includes(d.id);
                  return (
                    <button key={d.id} type="button" onClick={() => setEditDeptIds((prev) => selected ? prev.filter((id) => id !== d.id) : [...prev, d.id])} style={{
                      padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                      background: selected ? "#1a1a1a" : "#0a0c1e", border: selected ? "0.5px solid #B8860B" : "0.5px solid #1e2245", color: selected ? "#FFD700" : "#7b82b8",
                    }}>
                      {d.icon || "🏛️"} {d.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#DAA520", cursor: "pointer" }}>
                <input type="checkbox" checked={editForm.isPremium} onChange={(e) => setEditForm((p) => ({ ...p, isPremium: e.target.checked }))} />
                Premium resource
              </label>
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setEditResource(null)} style={{ flex: 1, padding: "10px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#DAA520", cursor: "pointer" }}>Cancel</button>
              <button onClick={submitEdit} disabled={editSaving} style={{ flex: 1, padding: "10px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "8px", fontSize: "14px", fontWeight: 700, color: "#FFD700", cursor: editSaving ? "not-allowed" : "pointer", opacity: editSaving ? 0.5 : 1 }}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #1e2245", borderRadius: "12px", padding: "24px", maxWidth: "400px", width: "90%" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "#e8eaf6", marginBottom: "8px" }}>Delete Resource?</div>
            <div style={{ fontSize: "14px", color: "#7b82b8", marginBottom: "20px", lineHeight: 1.5 }}>This action cannot be undone. Are you sure you want to delete this resource?</div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteConfirm(null)} style={{ flex: 1, padding: "10px", background: "#111328", border: "0.5px solid #2a2d4a", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#DAA520", cursor: "pointer" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} style={{ flex: 1, padding: "10px", background: "#2a0a0a", border: "0.5px solid #4a1010", borderRadius: "8px", fontSize: "14px", fontWeight: 600, color: "#ef9a9a", cursor: "pointer" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* MCQ Editor Modal */}
      {editingMcq && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", zIndex: 2000, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={(e) => e.target === e.currentTarget && setEditingMcq(null)}>
          <div style={{ background: "#0a0c1e", border: "0.5px solid #1e2140", borderTop: "2px solid #B8860B", borderRadius: "18px 18px 0 0", width: "100%", maxWidth: 720, maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 18px 10px", borderBottom: "0.5px solid #1e2140", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e8eaf6", flex: 1, fontFamily: "Syne,sans-serif" }}>Edit MCQ Questions — {editingMcq.title}</div>
              <button onClick={() => setEditingMcq(null)} style={{ background: "none", border: "none", color: "#4a5080", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
            <div style={{ overflowY: "auto", padding: "14px 18px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {mcqDrafts.map((q, qi) => (
                <div key={qi} style={{ background: "#0d0f1f", border: "0.5px solid #1e2140", borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#B8860B" }}>Q{qi + 1}</span>
                    <div style={{ flex: 1 }} />
                    <button onClick={() => setMcqDrafts((prev) => prev.filter((_, i) => i !== qi))} style={{ background: "#140808", border: "0.5px solid #4a1414", borderRadius: 7, padding: "3px 8px", fontSize: 11, color: "#ef9a9a", cursor: "pointer" }}>✕</button>
                  </div>
                  <textarea value={q.question} onChange={(e) => setMcqDrafts((prev) => prev.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))} rows={2} placeholder="Question text…" style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#DAA520", outline: "none", resize: "vertical", marginBottom: 8 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    {["A", "B", "C", "D"].map((l) => (
                      <div key={l} style={{ display: "flex", gap: 5, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: q.correct === l ? "#81c784" : "#4a5080", fontWeight: q.correct === l ? 700 : 400, flexShrink: 0, width: 14 }}>{l}:</span>
                        <input value={q.options?.[l] || ""} onChange={(e) => setMcqDrafts((prev) => prev.map((x, i) => i === qi ? { ...x, options: { ...x.options, [l]: e.target.value } } : x))} style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: 7, padding: "5px 8px", fontSize: 11, color: "#DAA520", outline: "none" }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    <select value={q.correct} onChange={(e) => setMcqDrafts((prev) => prev.map((x, i) => i === qi ? { ...x, correct: e.target.value } : x))} style={{ background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: 7, padding: "4px 8px", fontSize: 11, color: "#DAA520", outline: "none" }}>
                      {["A", "B", "C", "D"].map((l) => <option key={l} value={l}>✓ {l}</option>)}
                    </select>
                  </div>
                  <textarea value={q.explanation || ""} onChange={(e) => setMcqDrafts((prev) => prev.map((x, i) => i === qi ? { ...x, explanation: e.target.value } : x))} rows={2} placeholder="Explanation (optional)…" style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#DAA520", outline: "none", resize: "vertical" }} />
                </div>
              ))}
              <button onClick={() => setMcqDrafts((prev) => [...prev, { question: "", options: { A: "", B: "", C: "", D: "" }, correct: "A", explanation: "" }])} style={{ background: "#0d0f1f", border: "0.5px dashed #2a3080", borderRadius: 10, padding: "10px", fontSize: 12, color: "#DAA520", cursor: "pointer", fontWeight: 600 }}>
                + Add Question
              </button>
              <button onClick={saveMcq} disabled={mcqSaving} style={{ background: mcqSaving ? "#12142a" : "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: 10, padding: "12px 16px", fontSize: 14, color: mcqSaving ? "#4a5080" : "#FFD700", cursor: mcqSaving ? "not-allowed" : "pointer", fontWeight: 700, marginTop: 4 }}>
                {mcqSaving ? "Saving…" : `Save ${mcqDrafts.length} Question${mcqDrafts.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: "24px", left: "50%", transform: "translateX(-50%)", background: "#0f2a1a", border: "0.5px solid #2a6a3a", color: "#a5d6a7", padding: "10px 20px", borderRadius: "20px", fontSize: "13px", fontWeight: 600, zIndex: 999, display: "flex", alignItems: "center", gap: "8px", animation: "fadeup 0.2s ease" }}>
          <span>✓</span>{toast}
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowCreateFolder(false)}>
          <div style={{ background: "#0d0f20", border: "0.5px solid #2a2d4a", borderRadius: "18px", padding: "26px", width: "90%", maxWidth: "480px", maxHeight: "86vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#e8eaf6", margin: 0 }}>Create shared folder</h2>
              <button onClick={() => setShowCreateFolder(false)} style={{ background: "none", border: "none", color: "#4a5080", fontSize: "16px", cursor: "pointer", padding: "4px" }}>✕</button>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Folder name</label>
              <input value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="e.g. Anatomy — Year 1" style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }} />
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Course code (optional)</label>
              <input value={newFolderCourseCode} onChange={(e) => setNewFolderCourseCode(e.target.value)} placeholder="e.g. BIO 111" style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }} />
            </div>

            <div style={{ display: "flex", gap: "12px", marginBottom: "14px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Level</label>
                <select value={newFolderLevel} onChange={(e) => setNewFolderLevel(e.target.value)} style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }}>
                  <option value="">Any level</option>
                  {levels.map((l) => (<option key={l} value={l}>{l}</option>))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Semester</label>
                <select value={newFolderSemester} onChange={(e) => setNewFolderSemester(e.target.value)} style={{ width: "100%", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#DAA520", outline: "none" }}>
                  <option value="">Any semester</option>
                  {semesters.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "6px", display: "block" }}>Departments</label>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {departments.map((d) => {
                  const selected = newFolderDeptIds.includes(d.id);
                  return (
                    <button key={d.id} type="button" onClick={() => setNewFolderDeptIds((prev) => selected ? prev.filter((id) => id !== d.id) : [...prev, d.id])} style={{
                      padding: "6px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                      background: selected ? "#1a1a1a" : "#0a0c1e", border: selected ? "0.5px solid #B8860B" : "0.5px solid #1e2245", color: selected ? "#FFD700" : "#7b82b8",
                    }}>
                      {d.icon || "🏛️"} {d.name}
                    </button>
                  );
                })}
              </div>
              <p style={{ fontSize: 11, color: "#4a5080", marginTop: 6 }}>Students in selected departments can view and contribute to this folder.</p>
            </div>

            <div style={{ marginBottom: "18px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#7b82b8", marginBottom: "4px", display: "block" }}>Visibility</label>
              <div style={{ display: "flex", gap: "6px", background: "#0a0c1e", border: "0.5px solid #1e2245", borderRadius: "10px", padding: "4px" }}>
                {[["shared", "👥 Department"], ["link", "🔗 Link share"], ["private", "🔒 Private"]].map(([key, label]) => (
                  <button key={key} onClick={() => setNewFolderVisibility(key)} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: newFolderVisibility === key ? "#1a1a1a" : "none", fontSize: "13px", fontWeight: 700, color: newFolderVisibility === key ? "#FFD700" : "#4a5080", cursor: "pointer" }}>{label}</button>
                ))}
              </div>
            </div>

            <button onClick={handleCreateFolder} disabled={!newFolderName.trim()} style={{ width: "100%", padding: "12px", background: "#1a1a1a", border: "0.5px solid #B8860B", borderRadius: "10px", fontSize: "14px", fontWeight: 700, color: "#FFD700", cursor: !newFolderName.trim() ? "not-allowed" : "pointer", opacity: !newFolderName.trim() ? 0.5 : 1 }}>
              Create folder
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeup {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  );
}

const filterBtnStyle = {
  display: "flex", alignItems: "center", gap: "6px",
  padding: "8px 14px", borderRadius: "999px",
  fontSize: "13px", fontWeight: 600, cursor: "pointer",
};

const tabStyle = {
  padding: "8px 16px", borderRadius: "999px", background: "none", border: "none",
  fontSize: "13px", fontWeight: 600, color: "#4a5080", cursor: "pointer",
};

const tabActiveStyle = {
  padding: "8px 16px", borderRadius: "999px", background: "#1a1a1a", border: "none",
  fontSize: "13px", fontWeight: 700, color: "#FFD700", cursor: "pointer",
};
