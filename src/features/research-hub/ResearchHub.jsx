import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { copyShareToken } from "../../lib/researchUtils";
import { listFolders, createFolder, getFolder, deleteFolder as apiDeleteFolder } from "../../lib/foldersApi";
import ResourceViewer from "../ResourceViewer";
import { useUserData } from "../../contexts/UserDataContext";

import ResourceCard from "./ResourceCard";
import FilterBar from "./FilterBar";
import FolderDetailView from "./FolderDetailView";
import UploadModal from "./UploadModal";
import CreateFolderModal from "./CreateFolderModal";
import LibraryView from "./LibraryView.jsx";
import { colors, spacing, fontSize, fontWeight, sharedStyles, gold, goldDim, goldBorder, goldText } from "./constants";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const CACHE_TTL = 5 * 60 * 1000;

const emptyMcqRow = () => ({ question: "", options: { A: "", B: "", C: "", D: "" }, correct: "A", explanation: "" });

const filterTypes = ["all", "note", "pdf", "mcq", "tutorial_question"];
const filterLabels = { all: "All", note: "Notes", pdf: "PDF", mcq: "MCQ", tutorial_question: "Tutorial Q" };

const emptyMessages = {
  "public": "No resources found. Try a different search or clear filters.",
};

export default function ResearchHub({ onBack, onStreakUpdate } = {}) {
  const { setLastActivity } = useUserData();

  const [resources, setResources] = useState([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [activeTab, setActiveTab] = useState("library");
  const [toast, setToast] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarkBusyId, setBookmarkBusyId] = useState(null);
  const [filters, setFilters] = useState({ department: "all", level: "all", semester: "all", subject: "all" });
  const [fsrsStats, setFsrsStats] = useState(null);
  const [fsrsAnalytics, setFsrsAnalytics] = useState(null);
  const [viewerInitialPage, setViewerInitialPage] = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFab, setShowFab] = useState(false);
  const [uploadType, setUploadType] = useState("pdf");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadSubject, setUploadSubject] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadPreview, setUploadPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [mcqRows, setMcqRows] = useState([emptyMcqRow()]);
  const fileInputRef = useRef(null);

  const [folders, setFolders] = useState({ own: [], shared: [] });
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderDetail, setFolderDetail] = useState(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCourseCode, setNewFolderCourseCode] = useState("");
  const [newFolderVisibility, setNewFolderVisibility] = useState("private");
  const [newFolderLevel, setNewFolderLevel] = useState("");
  const [newFolderSemester, setNewFolderSemester] = useState("");
  const [activeFolderTab, setActiveFolderTab] = useState("materials");
  const [uploadFolderId, setUploadFolderId] = useState(null);
  const [mcqProgress, setMcqProgress] = useState({});

  useEffect(() => {
    fetchResources();
    fetchFsrsStats();
    fetchFsrsAnalytics();
    fetchFolders();
    fetchMcqProgress();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const tab = e.detail?.tab;
      if (tab === "department" || tab === "space" || tab === "fsrs" || tab === "progress") {
        setActiveTab("library");
      } else if (tab) {
        setActiveTab(tab);
      }
    };
    window.addEventListener("sc-open-research-hub", handler);
    return () => window.removeEventListener("sc-open-research-hub", handler);
  }, []);

  useEffect(() => {
    if (window.__sc_pending_hub_tab) {
      const { tab, subTab } = window.__sc_pending_hub_tab;
      if (tab === "department" || tab === "space" || tab === "fsrs" || tab === "progress") {
        setActiveTab("library");
      } else if (tab) {
        setActiveTab(tab);
      }
      window.__sc_pending_hub_tab = null;
    }
  }, []);

  useEffect(() => {
    if (activeTab === "library") {
      fetchBookmarks();
    }
  }, [activeTab]);

  const getAuthHeaders = () => {
    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    return { Authorization: `Bearer ${authData.authToken}` };
  };

  const fetchResources = async () => {
    const cacheKey = "sc_resources_list";
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) { setResources(data); return; }
      }
    } catch {}
    try {
      const response = await fetch(`${API_BASE}/api/resources`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setResources(data);
        try { localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })); } catch {}
      }
    } catch (err) {
      console.error("Failed to fetch resources:", err);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/bookmarks`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedIds(new Set(data.map((r) => r.id)));
      }
    } catch {}
  };

  const fetchFsrsStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() });
      if (res.ok) setFsrsStats(await res.json());
    } catch {}
  };

  const fetchFsrsAnalytics = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/analytics?days=30`, { headers: getAuthHeaders() });
      if (res.ok) setFsrsAnalytics(await res.json());
    } catch {}
  };

  const fetchFolders = async () => {
    try {
      setFolders(await listFolders());
    } catch {}
  };

  const fetchMcqProgress = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/my-mcq-progress`, { headers: getAuthHeaders() });
      if (res.ok) setMcqProgress(await res.json());
    } catch {}
  };

  const fetchFolderDetail = async (folderId) => {
    setFolderLoading(true);
    try {
      setFolderDetail(await getFolder(folderId));
    } catch {
      showToast("Failed to load folder");
    } finally {
      setFolderLoading(false);
    }
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { showToast("Folder name required"); return; }
    try {
      const data = await createFolder({
        name: newFolderName.trim(),
        courseCode: newFolderCourseCode.trim() || null,
        visibility: newFolderVisibility,
        level: newFolderLevel || null,
        semester: newFolderSemester || null,
      });
      setFolders((prev) => ({ ...prev, own: [data, ...(prev.own || [])] }));
      setShowCreateFolder(false);
      setNewFolderName(""); setNewFolderCourseCode(""); setNewFolderVisibility("private");
      setNewFolderLevel(""); setNewFolderSemester("");
      showToast("Folder created ✓");
    } catch (err) {
      showToast(err.message || "Failed to create folder");
    }
  };

  const handleDeleteFolder = async (folderId) => {
    if (!confirm("Delete this folder? Resources inside will remain but lose folder association.")) return;
    try {
      await apiDeleteFolder(folderId);
      setFolders((prev) => ({ ...prev, own: (prev.own || []).filter((f) => f.id !== folderId) }));
      if (activeFolder === folderId) { setActiveFolder(null); setFolderDetail(null); }
      showToast("Folder deleted");
    } catch {
      showToast("Failed to delete folder");
    }
  };

  const handleShareFolder = async (folder) => {
    if (!folder.shareToken) { showToast("Share not available"); return; }
    const url = `${window.location.origin}/folders/${folder.shareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Folder link copied! 🔗");
    } catch {
      showToast("Could not copy link");
    }
  };

  const openFolder = (folderId) => {
    setActiveFolder(folderId);
    setFolderDetail(null);
    setActiveFolderTab("materials");
    fetchFolderDetail(folderId);
  };

  const closeFolder = () => {
    setActiveFolder(null);
    setFolderDetail(null);
    setActiveFolderTab("materials");
  };

  const openUploadInFolder = (folderId, type) => {
    setUploadFolderId(folderId);
    openUpload(type);
  };

  const getCurrentUserId = () => {
    try {
      return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}")?.authUser?.id || null;
    } catch { return null; }
  };

  const folderResources = useMemo(() => {
    if (!folderDetail) return [];
    const shared = folderDetail.sharedResources || [];
    const mine = folderDetail.myResources || [];
    return [...mine, ...shared];
  }, [folderDetail]);

  const folderCategorized = useMemo(() => {
    const materials = [], summaries = [], flashcards = [], mcqs = [];
    for (const r of folderResources) {
      if (r.contentType === "mcq") mcqs.push(r);
      else if (r.contentType === "flashcard_deck") flashcards.push(r);
      else if (r.title?.startsWith("[AI] Summary")) summaries.push(r);
      else materials.push(r);
    }
    return { materials, summaries, flashcards, mcqs };
  }, [folderResources]);

  const folderIsOwner = useMemo(() => {
    if (!folderDetail) return false;
    const uid = getCurrentUserId();
    return uid && folderDetail.ownerId === uid;
  }, [folderDetail]);

  const handleQuizComplete = useCallback((data) => {
    fetchFsrsStats(); fetchFsrsAnalytics();
    fetchMcqProgress();
    if (onStreakUpdate && data.streak != null) onStreakUpdate(data.streak, data.longestStreak);
  }, [onStreakUpdate]);

  const handleShare = useCallback(async (token) => {
    const success = await copyShareToken(token);
    if (success) showToast("Link copied! 🔗");
  }, []);

  const handleOpen = useCallback((token) => {
    const res = resources.find((r) => r.shareToken === token);
    if (res) setLastActivity({ resourceId: res.id, resourceTitle: res.title, subjectId: res.subject });
    setViewerToken(token);
  }, [resources, setLastActivity]);

  const toggleBookmark = useCallback(async (resource) => {
    const isBookmarked = bookmarkedIds.has(resource.id);
    setBookmarkBusyId(resource.id);
    const prevIds = bookmarkedIds;
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(resource.id); else next.add(resource.id);
      return next;
    });
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resource.id}/bookmark`, {
        method: isBookmarked ? "DELETE" : "POST",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        showToast(isBookmarked ? "Removed from your space" : "Added to your space ✓");
      } else {
        setBookmarkedIds(prevIds);
        showToast("Failed to update bookmark");
      }
    } catch {
      setBookmarkedIds(prevIds);
      showToast("Network error — try again");
    } finally {
      setBookmarkBusyId(null);
    }
  }, [bookmarkedIds]);

  const openUpload = (type) => {
    setUploadType(type);
    setUploadTitle(""); setUploadSubject(""); setUploadFile(null);
    setUploadDescription(""); setUploadPreview(null); setUploadProgress(0);
    setMcqRows([emptyMcqRow()]);
    setShowUploadModal(true);
  };

  const closeUpload = () => {
    if (uploading) return;
    setShowUploadModal(false);
    setUploadFolderId(null);
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadPreview(null);
  };

  const submitFileUpload = () => {
    if (!uploadTitle.trim() || !uploadSubject.trim()) { showToast("Add a title and subject first"); return; }
    if (uploadType !== "note" && !uploadFile) { showToast("Choose a file first"); return; }
    if (uploadType === "note" && !uploadDescription.trim()) { showToast("Write some note content first"); return; }
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("title", uploadTitle.trim());
    formData.append("subject", uploadSubject.trim());
    formData.append("contentType", uploadType);
    formData.append("isPremium", "false");
    if (uploadFile) formData.append("file", uploadFile);
    if (uploadDescription.trim()) formData.append("description", uploadDescription.trim());
    if (uploadFolderId) formData.append("folderId", uploadFolderId);

    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resource = JSON.parse(xhr.responseText);
          if (resource.status === "approved") {
            setResources((prev) => {
              const updated = [resource, ...prev];
              try { localStorage.setItem("sc_resources_list", JSON.stringify({ data: updated, ts: Date.now() })); } catch {}
              return updated;
            });
          }
        } catch {}
        setShowUploadModal(false);
        if (uploadPreview) URL.revokeObjectURL(uploadPreview);
        setUploadPreview(null);
        showToast("Uploaded ✓");
        if (uploadFolderId) { fetchFolderDetail(uploadFolderId); setUploadFolderId(null); }
        else { fetchResources(); }
      } else {
        showToast("Upload failed");
      }
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      showToast("Upload failed — check your connection");
    });
    xhr.open("POST", `${API_BASE}/api/resources`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  const submitMcqUpload = () => {
    if (!uploadTitle.trim() || !uploadSubject.trim()) { showToast("Add a title and subject first"); return; }
    const incomplete = mcqRows.some((row) => !row.question.trim() || Object.values(row.options).some((o) => !o.trim()));
    if (incomplete) { showToast("Fill in every question and all 4 options"); return; }
    setUploading(true);

    const formData = new FormData();
    formData.append("title", uploadTitle.trim());
    formData.append("subject", uploadSubject.trim());
    formData.append("contentType", "mcq");
    formData.append("isPremium", "false");
    formData.append("mcqData", JSON.stringify(mcqRows));
    if (uploadFolderId) formData.append("folderId", uploadFolderId);

    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;

    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener("load", () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const resource = JSON.parse(xhr.responseText);
          if (resource.status === "approved") {
            setResources((prev) => {
              const updated = [resource, ...prev];
              try { localStorage.setItem("sc_resources_list", JSON.stringify({ data: updated, ts: Date.now() })); } catch {}
              return updated;
            });
          }
        } catch {}
        setShowUploadModal(false);
        showToast("MCQs submitted ✓");
        if (uploadFolderId) { fetchFolderDetail(uploadFolderId); setUploadFolderId(null); }
        else { fetchResources(); }
      } else {
        showToast("Submission failed");
      }
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      showToast("Submission failed — check your connection");
    });
    xhr.open("POST", `${API_BASE}/api/resources`);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  const subjects = useMemo(() => {
    const set = new Set(resources.map((r) => r.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const tabResources = useMemo(() => {
    if (activeTab === "community") return resources;
    return [];
  }, [activeTab, resources]);

  const visibleResources = useMemo(() => {
    let list = (tabResources || []).filter((r) => {
      const matchesSearch = search === "" || r.title.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase());
      const matchesType = activeFilter === "all" || r.contentType === activeFilter;
      const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
      const matchesLevel = filters.level === "all" || r.level === filters.level;
      const matchesSemester = filters.semester === "all" || r.semester === filters.semester;
      const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
      return matchesSearch && matchesType && matchesDept && matchesLevel && matchesSemester && matchesSubject;
    });
    const sorted = [...list];
    if (sortBy === "views") sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    else if (sortBy === "recent") sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sortBy === "bookmarks") sorted.sort((a, b) => (b._count?.bookmarks || 0) - (a._count?.bookmarks || 0));
    return sorted;
  }, [tabResources, search, activeFilter, filters, sortBy]);

  const uploadModal = (
    <UploadModal
      show={showUploadModal}
      onClose={closeUpload}
      uploadType={uploadType} setUploadType={setUploadType}
      uploadTitle={uploadTitle} setUploadTitle={setUploadTitle}
      uploadSubject={uploadSubject} setUploadSubject={setUploadSubject}
      uploadFile={uploadFile} setUploadFile={setUploadFile}
      uploadDescription={uploadDescription} setUploadDescription={setUploadDescription}
      uploadPreview={uploadPreview} setUploadPreview={setUploadPreview}
      uploadProgress={uploadProgress} setUploadProgress={setUploadProgress}
      uploading={uploading} setUploading={setUploading}
      dragOver={dragOver} setDragOver={setDragOver}
      mcqRows={mcqRows} setMcqRows={setMcqRows}
      subjects={subjects}
      fileInputRef={fileInputRef}
      onSubmitFile={submitFileUpload}
      onSubmitMcq={submitMcqUpload}
    />
  );

  const createFolderModal = (
    <CreateFolderModal
      show={showCreateFolder}
      onClose={() => setShowCreateFolder(false)}
      onCreate={handleCreateFolder}
      newName={newFolderName} setNewName={setNewFolderName}
      newCourseCode={newFolderCourseCode} setNewCourseCode={setNewFolderCourseCode}
      newVisibility={newFolderVisibility} setNewVisibility={setNewFolderVisibility}
      newLevel={newFolderLevel} setNewLevel={setNewFolderLevel}
      newSemester={newFolderSemester} setNewSemester={setNewFolderSemester}
    />
  );

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} initialPage={viewerInitialPage} onBack={() => { setViewerToken(null); setViewerInitialPage(null); }} onQuizComplete={handleQuizComplete} />;
  }

  if (activeFolder) {
    return (
      <FolderDetailView
        folderDetail={folderDetail}
        folderLoading={folderLoading}
        folderCategorized={folderCategorized}
        activeFolderTab={activeFolderTab}
        setActiveFolderTab={setActiveFolderTab}
        folderIsOwner={folderIsOwner}
        onClose={closeFolder}
        onShareFolder={handleShareFolder}
        onDeleteFolder={handleDeleteFolder}
        onUploadToFolder={openUploadInFolder}
        onCreateMcq={(fid) => openUploadInFolder(fid, "mcq")}
        bookmarkedIds={bookmarkedIds}
        bookmarkBusyId={bookmarkBusyId}
        onOpen={handleOpen}
        onToggleBookmark={toggleBookmark}
        onShare={handleShare}
        mcqProgress={mcqProgress}
        uploadModal={uploadModal}
        createFolderModal={createFolderModal}
      />
    );
  }

  const communityResources = useMemo(() => resources, [resources]);

  return (
    <div style={{ padding: spacing.xl, maxWidth: "1200px", margin: "0 auto" }}>
      <div className="sc-tabrow" style={sharedStyles.tabRow}>
        {[["library", "� Library"], ["community", "🌐 Community"]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={activeTab === key ? sharedStyles.tabActive : sharedStyles.tab}>
            {label}
            {key === "library" && fsrsStats && fsrsStats.dueCount > 0 && <span style={sharedStyles.tabCount}>{fsrsStats.dueCount}</span>}
          </button>
        ))}
      </div>

      {activeTab === "library" ? (
        <LibraryView
          resources={resources}
          currentUserId={getCurrentUserId()}
          fsrsStats={fsrsStats}
          fsrsAnalytics={fsrsAnalytics}
          folders={folders}
          bookmarkedIds={bookmarkedIds}
          bookmarkBusyId={bookmarkBusyId}
          mcqProgress={mcqProgress}
          onOpen={handleOpen}
          onToggleBookmark={toggleBookmark}
          onShare={handleShare}
          onOpenPdf={(token, page) => {
            const res = resources.find((r) => r.shareToken === token);
            if (res) setLastActivity({ resourceId: res.id, resourceTitle: res.title, subjectId: res.subject });
            setViewerInitialPage(page || null);
            setViewerToken(token);
          }}
          onRefresh={() => { fetchFsrsStats(); fetchFsrsAnalytics(); fetchResources(); }}
          onCreateFolder={() => setShowCreateFolder(true)}
          onOpenFolder={openFolder}
        />
      ) : (
        <>
          <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.md, flexWrap: "wrap" }}>
            <div style={{ ...sharedStyles.searchWrap, flex: "1 1 240px" }}>
              <span style={{ color: "#3a3d60", fontSize: fontSize.lg }}>🔍</span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, PDFs, MCQs…" style={sharedStyles.searchInput} />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={sharedStyles.select}>
              <option value="recent">Most recent</option>
              <option value="views">Most viewed</option>
              <option value="bookmarks">Most saved</option>
            </select>
          </div>

          <FilterBar filters={filters} setFilters={setFilters} resources={communityResources} />

          <div style={{ display: "flex", gap: spacing.sm, overflowX: "auto", marginBottom: spacing.xl, paddingBottom: spacing.xs }}>
            {filterTypes.map((type) => (
              <button key={type} onClick={() => setActiveFilter(type)} style={activeFilter === type ? sharedStyles.chipActive : sharedStyles.chip}>
                {filterLabels[type]}
              </button>
            ))}
          </div>

          <div style={sharedStyles.sectionLabel}>COMMUNITY</div>

          {visibleResources.length === 0 ? (
            <div style={sharedStyles.emptyState}>
              <div style={{ fontSize: 36, marginBottom: spacing.sm }}>📭</div>
              <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
                No results
              </div>
              <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
                {emptyMessages["public"]}
              </div>
            </div>
          ) : (
            <div style={sharedStyles.grid}>
              {visibleResources.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  isBookmarked={bookmarkedIds.has(resource.id)}
                  bookmarkBusy={bookmarkBusyId === resource.id}
                  onOpen={handleOpen}
                  onToggleBookmark={toggleBookmark}
                  onShare={handleShare}
                  mcqProgress={mcqProgress}
                />
              ))}
            </div>
          )}
        </>
      )}

      {toast && (
        <div style={sharedStyles.toast}>
          <span>✓</span>{toast}
        </div>
      )}

      {showFab && (
        <div onClick={() => setShowFab(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 998, animation: "fadeup 0.15s ease",
        }} />
      )}

      <div style={{
        position: "fixed", bottom: "24px", right: "24px", zIndex: 999,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px",
      }}>
        {showFab && (
          <>
            <FabAction
              icon="📎"
              label="Upload Material"
              subtitle="PDF, Image, DOCX, Note…"
              onClick={() => { openUpload("pdf"); setShowFab(false); }}
            />
            <FabAction
              icon="📁"
              label="Create New Folder"
              subtitle="Organize your study materials"
              onClick={() => { setShowCreateFolder(true); setShowFab(false); }}
            />
            <FabAction
              icon="✎"
              label="Generate MCQs"
              subtitle="Build a quiz question set"
              onClick={() => { openUpload("mcq"); setShowFab(false); }}
            />
          </>
        )}
        <button
          onClick={() => setShowFab((v) => !v)}
          style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: showFab ? colors.surface : gold,
            border: `2px solid ${gold}`,
            boxShadow: showFab ? "0 4px 16px rgba(0,0,0,0.4)" : "0 4px 20px rgba(255,215,0,0.3)",
            fontSize: "28px", fontWeight: fontWeight.bold,
            color: showFab ? goldText : "#0a0a0a",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all 0.2s ease", transform: showFab ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          +
        </button>
      </div>

      {uploadModal}
      {createFolderModal}

      <style>{`
        @keyframes fadeup {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes fabslide {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sc-tabrow::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

function FabAction({ icon, label, subtitle, onClick }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: "12px", cursor: "pointer",
      animation: "fabslide 0.2s ease",
    }}>
      <div style={{
        background: colors.surface, border: `0.5px solid ${goldBorder}`,
        borderRadius: "10px", padding: "8px 14px", textAlign: "right",
        boxShadow: "0 2px 12px rgba(0,0,0,0.4)",
      }}>
        <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: goldText, whiteSpace: "nowrap" }}>{label}</div>
        <div style={{ fontSize: fontSize.xs, color: colors.textDim, whiteSpace: "nowrap" }}>{subtitle}</div>
      </div>
      <div style={{
        width: "44px", height: "44px", borderRadius: "50%",
        background: goldDim, border: `1px solid ${goldBorder}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "20px", flexShrink: 0,
      }}>
        {icon}
      </div>
    </div>
  );
}
