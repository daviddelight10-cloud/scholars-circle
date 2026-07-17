import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { copyShareToken } from "../../lib/researchUtils";
import { listFolders, createFolder, getFolder, deleteFolder as apiDeleteFolder } from "../../lib/foldersApi";
import { getMyProfile } from "../../lib/profileApi.js";
import ResourceViewer from "../ResourceViewer";
import { useUserData } from "../../contexts/UserDataContext";

import ResourceCard from "./ResourceCard";
import FilterBar from "./FilterBar";
import FolderDetailView from "./FolderDetailView";
import UploadWizard from "./UploadWizard";
import BookmarkSpacePicker from "./BookmarkSpacePicker";
import CreateFolderModal from "./CreateFolderModal";
import LibraryView from "./LibraryView.jsx";
import DepartmentView from "./DepartmentView.jsx";
import { colors, spacing, fontSize, fontWeight, sharedStyles, gold, goldDim, goldBorder, goldText } from "./constants";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const CACHE_TTL = 5 * 60 * 1000;

const filterTypes = ["all", "note", "pdf", "mcq", "tutorial_question"];
const filterLabels = { all: "All", note: "Notes", pdf: "PDF", mcq: "MCQ", tutorial_question: "Tutorial Q" };

const emptyMessages = {
  "public": "No resources found. Try a different search or clear filters.",
};

export default function ResearchHub({ onBack, onStreakUpdate, activeSemester } = {}) {
  const { setLastActivity } = useUserData();

  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [activeTab, setActiveTab] = useState("library");
  const [toast, setToast] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarkFolderMap, setBookmarkFolderMap] = useState({});
  const [bookmarkBusyId, setBookmarkBusyId] = useState(null);
  const [showBookmarkPicker, setShowBookmarkPicker] = useState(false);
  const [bookmarkTarget, setBookmarkTarget] = useState(null);
  const [filters, setFilters] = useState({ university: "all", department: "all", level: "all", semester: activeSemester || "all", subject: "all" });
  const [userProfile, setUserProfile] = useState(null);
  const [fsrsStats, setFsrsStats] = useState(null);
  const [fsrsAnalytics, setFsrsAnalytics] = useState(null);
  const [viewerInitialPage, setViewerInitialPage] = useState(null);

  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [wizardPresetFolderId, setWizardPresetFolderId] = useState(null);
  const [showFab, setShowFab] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

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
  const [mcqProgress, setMcqProgress] = useState({});

  useEffect(() => {
    fetchResources();
    fetchFsrsStats();
    fetchFsrsAnalytics();
    fetchFolders();
    fetchBookmarks();
    fetchMcqProgress();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const data = await getMyProfile();
      if (data?.profile) setUserProfile(data.profile);
    } catch {}
  };

  useEffect(() => {
    const handler = (e) => {
      const tab = e.detail?.tab;
      if (tab === "space" || tab === "fsrs" || tab === "progress") {
        setActiveTab("library");
      } else if (tab === "department") {
        setActiveTab("department");
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
      if (tab === "space" || tab === "fsrs" || tab === "progress") {
        setActiveTab("library");
      } else if (tab === "department") {
        setActiveTab("department");
      } else if (tab) {
        setActiveTab(tab);
      }
      window.__sc_pending_hub_tab = null;
    }
  }, []);

  useEffect(() => {
    if (activeTab === "library" || activeTab === "department") {
      fetchBookmarks();
    }
  }, [activeTab]);

  const getAuthHeaders = () => {
    try {
      const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
      return authData.authToken ? { Authorization: `Bearer ${authData.authToken}` } : {};
    } catch {
      return {};
    }
  };

  const fetchResources = async () => {
    setResourcesError(null);
    const cacheKey = "sc_resources_list";
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL && Array.isArray(data) && data.length > 0) {
          setResources(data);
          setResourcesLoading(false);
          return;
        }
      }
    } catch {}
    setResourcesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/resources`, { headers: getAuthHeaders() });
      if (response.ok) {
        const data = await response.json();
        setResources(data);
        if (Array.isArray(data) && data.length > 0) {
          try { localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })); } catch {}
        } else {
          try { localStorage.removeItem(cacheKey); } catch {}
        }
      } else if (response.status === 401) {
        setResourcesError("Your session has expired. Please log in again.");
      } else {
        setResourcesError(`Failed to load materials (HTTP ${response.status}).`);
      }
    } catch (err) {
      console.error("Failed to fetch resources:", err);
      setResourcesError("Network error — could not reach the server. Check your connection and try again.");
    } finally {
      setResourcesLoading(false);
    }
  };

  const fetchBookmarks = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resources/bookmarks`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setBookmarkedIds(new Set(data.map((r) => r.id)));
        const folderMap = {};
        for (const r of data) {
          if (r.bookmarkFolderId) folderMap[r.id] = r.bookmarkFolderId;
        }
        setBookmarkFolderMap(folderMap);
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
        universityId: userProfile?.universityId || null,
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

  const openUploadInFolder = (folderId) => {
    setWizardPresetFolderId(folderId);
    setUploadProgress(0);
    setShowUploadWizard(true);
  };

  const getCurrentUserId = () => {
    try {
      const id = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}")?.authUser?.id;
      return id != null ? String(id) : null;
    } catch { return null; }
  };

  const folderResources = useMemo(() => {
    if (!folderDetail) return [];
    const shared = folderDetail.sharedResources || [];
    const mine = folderDetail.myResources || [];
    const bookmarked = folderDetail.bookmarkedResources || [];
    const seen = new Set();
    const combined = [];
    for (const r of [...mine, ...shared, ...bookmarked]) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        combined.push(r);
      }
    }
    return combined;
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
    return uid && String(folderDetail.ownerId) === uid;
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

  const toggleBookmark = useCallback((resource) => {
    const isBookmarked = bookmarkedIds.has(resource.id);
    if (isBookmarked) {
      // Unbookmark directly — no picker needed
      setBookmarkBusyId(resource.id);
      const prevIds = bookmarkedIds;
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        next.delete(resource.id);
        return next;
      });
      setBookmarkFolderMap((prev) => {
        const next = { ...prev };
        delete next[resource.id];
        return next;
      });
      fetch(`${API_BASE}/api/resources/${resource.id}/bookmark`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      }).then((res) => {
        if (res.ok) showToast("Removed from your space");
        else {
          setBookmarkedIds(prevIds);
          showToast("Failed to remove bookmark");
        }
      }).catch(() => {
        setBookmarkedIds(prevIds);
        showToast("Network error — try again");
      }).finally(() => setBookmarkBusyId(null));
    } else {
      // Show the space picker
      setBookmarkTarget(resource);
      setShowBookmarkPicker(true);
    }
  }, [bookmarkedIds]);

  const handleBookmarkWithFolder = useCallback(async (resource, folderId) => {
    setBookmarkBusyId(resource.id);
    const prevIds = bookmarkedIds;
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      next.add(resource.id);
      return next;
    });
    if (folderId) {
      setBookmarkFolderMap((prev) => ({ ...prev, [resource.id]: folderId }));
    }
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resource.id}/bookmark`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ folderId: folderId || null }),
      });
      if (res.ok) {
        showToast(folderId ? "Added to space ✓" : "Added to your space ✓");
        fetchBookmarks();
        if (folderId && activeFolder === folderId) fetchFolderDetail(folderId);
      } else {
        setBookmarkedIds(prevIds);
        showToast("Failed to bookmark");
      }
    } catch {
      setBookmarkedIds(prevIds);
      showToast("Network error — try again");
    } finally {
      setBookmarkBusyId(null);
      setShowBookmarkPicker(false);
      setBookmarkTarget(null);
    }
  }, [bookmarkedIds, activeFolder]);

  const openUpload = () => {
    setWizardPresetFolderId(null);
    setUploadProgress(0);
    setShowUploadWizard(true);
  };

  const closeUploadWizard = () => {
    if (uploading) return;
    setShowUploadWizard(false);
    setWizardPresetFolderId(null);
  };

  const handleWizardFileUpload = (data) => {
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("subject", data.subject);
    formData.append("contentType", data.contentType);
    formData.append("isPremium", "false");
    if (data.file) formData.append("file", data.file);
    if (data.description) formData.append("description", data.description);
    if (data.folderId) formData.append("folderId", data.folderId);
    if (userProfile?.universityId) formData.append("universityId", userProfile.universityId);

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
            try { localStorage.removeItem("sc_resources_list"); } catch {}
            setResources((prev) => [resource, ...prev]);
          }
        } catch {}
        setShowUploadWizard(false);
        showToast("Saved to space ✓");
        if (data.folderId) { fetchFolderDetail(data.folderId); }
        else { fetchResources(); fetchFolders(); }
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

  const handleWizardStudyToolSave = (data) => {
    setUploading(true);
    setUploadProgress(0);

    const body = {
      title: data.title,
      subject: data.subject,
      contentType: data.contentType,
    };
    if (data.mcqData) body.mcqData = data.mcqData;
    if (data.flashcardData) body.flashcardData = data.flashcardData;
    if (data.description) body.description = data.description;
    if (data.fileBuffer) body.fileBuffer = data.fileBuffer;
    if (data.fileName) body.fileName = data.fileName;
    if (data.folderId) body.folderId = data.folderId;
    body.isPublic = false;

    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;

    fetch(`${API_BASE}/api/resources/study-tool-save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to save");
        return res.json();
      })
      .then((resource) => {
        setUploading(false);
        try { localStorage.removeItem("sc_resources_list"); } catch {}
        setResources((prev) => [resource, ...prev]);
        setShowUploadWizard(false);
        showToast("Saved to space ✓");
        if (data.folderId) { fetchFolderDetail(data.folderId); }
        else { fetchResources(); fetchFolders(); }
      })
      .catch(() => {
        setUploading(false);
        showToast("Failed to save — try again");
      });
  };

  const subjects = useMemo(() => {
    const set = new Set(resources.filter((r) => r.status !== "rejected").map((r) => r.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const tabResources = useMemo(() => {
    if (activeTab === "community") return resources.filter((r) => r.status !== "rejected");
    return [];
  }, [activeTab, resources]);

  const visibleResources = useMemo(() => {
    let list = (tabResources || []).filter((r) => {
      const matchesSearch = search === "" || r.title.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase());
      const matchesType = activeFilter === "all" || r.contentType === activeFilter;
      const matchesUni = filters.university === "all" || r.university?.name === filters.university;
      const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
      const matchesLevel = filters.level === "all" || r.level === filters.level;
      const matchesSemester = filters.semester === "all" || r.semester === filters.semester;
      const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
      return matchesSearch && matchesType && matchesUni && matchesDept && matchesLevel && matchesSemester && matchesSubject;
    });
    if (list.length === 0 && filters.semester !== "all" && (tabResources || []).length > 0) {
      list = (tabResources || []).filter((r) => {
        const matchesSearch = search === "" || r.title.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase());
        const matchesType = activeFilter === "all" || r.contentType === activeFilter;
        const matchesUni = filters.university === "all" || r.university?.name === filters.university;
        const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
        const matchesLevel = filters.level === "all" || r.level === filters.level;
        const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
        return matchesSearch && matchesType && matchesUni && matchesDept && matchesLevel && matchesSubject;
      });
    }
    const sorted = [...list];
    if (sortBy === "views") sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    else if (sortBy === "recent") sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sortBy === "bookmarks") sorted.sort((a, b) => (b._count?.bookmarks || 0) - (a._count?.bookmarks || 0));
    return sorted;
  }, [tabResources, search, activeFilter, filters, sortBy]);

  const uploadWizard = (
    <UploadWizard
      show={showUploadWizard}
      onClose={closeUploadWizard}
      subjects={subjects}
      folders={folders}
      presetFolderId={wizardPresetFolderId}
      userProfile={userProfile}
      onUploadFile={handleWizardFileUpload}
      onSaveStudyTool={handleWizardStudyToolSave}
      uploading={uploading}
      uploadProgress={uploadProgress}
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

  const bookmarkPicker = (
    <BookmarkSpacePicker
      show={showBookmarkPicker}
      onClose={() => { setShowBookmarkPicker(false); setBookmarkTarget(null); }}
      resource={bookmarkTarget}
      folders={folders}
      onConfirm={handleBookmarkWithFolder}
      onCreateFolder={() => { setShowBookmarkPicker(false); setShowCreateFolder(true); }}
    />
  );

  const communityResources = useMemo(() => resources.filter((r) => r.status !== "rejected"), [resources]);

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
        bookmarkedIds={bookmarkedIds}
        bookmarkFolderMap={bookmarkFolderMap}
        bookmarkBusyId={bookmarkBusyId}
        onOpen={handleOpen}
        onToggleBookmark={toggleBookmark}
        onShare={handleShare}
        mcqProgress={mcqProgress}
        uploadModal={uploadWizard}
        createFolderModal={createFolderModal}
        bookmarkPicker={bookmarkPicker}
      />
    );
  }

  return (
    <div style={{ padding: spacing.xl, maxWidth: "1200px", margin: "0 auto" }}>
      <div className="sc-tabrow" style={sharedStyles.tabRow}>
        {[["library", "📚 My Space"], ["community", "🌐 Community"], ["department", "🏛️ Department"]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} style={activeTab === key ? sharedStyles.tabActive : sharedStyles.tab}>
            {label}
            {key === "library" && fsrsStats && fsrsStats.dueCount > 0 && <span style={sharedStyles.tabCount}>{fsrsStats.dueCount}</span>}
          </button>
        ))}
      </div>

      {activeTab === "library" ? (
        <LibraryView
          resources={resources}
          resourcesLoading={resourcesLoading}
          resourcesError={resourcesError}
          onRetry={fetchResources}
          currentUserId={getCurrentUserId()}
          fsrsStats={fsrsStats}
          folders={folders}
          bookmarkedIds={bookmarkedIds}
          bookmarkFolderMap={bookmarkFolderMap}
          bookmarkBusyId={bookmarkBusyId}
          mcqProgress={mcqProgress}
          onOpen={handleOpen}
          onToggleBookmark={toggleBookmark}
          onShare={handleShare}
          onCreateFolder={() => setShowCreateFolder(true)}
          onOpenFolder={openFolder}
        />
      ) : activeTab === "department" ? (
        <DepartmentView
          resources={resources}
          resourcesLoading={resourcesLoading}
          resourcesError={resourcesError}
          onRetry={fetchResources}
          currentUserId={getCurrentUserId()}
          userProfile={userProfile}
          fsrsStats={fsrsStats}
          folders={folders}
          bookmarkedIds={bookmarkedIds}
          bookmarkBusyId={bookmarkBusyId}
          mcqProgress={mcqProgress}
          onOpen={handleOpen}
          onToggleBookmark={toggleBookmark}
          onShare={handleShare}
          onOpenFolder={openFolder}
          onCreateFolder={() => setShowCreateFolder(true)}
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

          {resourcesLoading ? (
            <div style={sharedStyles.emptyState}>
              <div style={{ fontSize: 36, marginBottom: spacing.sm }}>⏳</div>
              <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
                Loading materials…
              </div>
            </div>
          ) : resourcesError ? (
            <div style={sharedStyles.emptyState}>
              <div style={{ fontSize: 36, marginBottom: spacing.sm }}>⚠️</div>
              <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
                Something went wrong
              </div>
              <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5, marginBottom: spacing.md }}>
                {resourcesError}
              </div>
              <button onClick={fetchResources} style={{ ...sharedStyles.chipActive, cursor: "pointer" }}>↻ Retry</button>
            </div>
          ) : visibleResources.length === 0 ? (
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

      {showFab && (activeTab === "library" || activeTab === "department") && (
        <div onClick={() => setShowFab(false)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          zIndex: 998, animation: "fadeup 0.15s ease",
        }} />
      )}

      <div style={{
        position: "fixed", bottom: "24px", right: "24px", zIndex: 999,
        display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "12px",
      }}>
        {showFab && (activeTab === "library" || activeTab === "department") && (
          <>
            <FabAction
              icon="📎"
              label="Upload to Space"
              subtitle="PDF, Image, DOCX, Note, AI tools…"
              onClick={() => { openUpload(); setShowFab(false); }}
            />
            <FabAction
              icon="📁"
              label="Create New Space"
              subtitle="Organize your study materials"
              onClick={() => { setShowCreateFolder(true); setShowFab(false); }}
            />
          </>
        )}
        {(activeTab === "library" || activeTab === "department") && (
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
        )}
      </div>

      {uploadWizard}
      {createFolderModal}
      {bookmarkPicker}

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
