import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { copyShareToken } from "../../lib/researchUtils";
import { listFolders, createFolder, getFolder, deleteFolder as apiDeleteFolder, bookmarkFolder as apiBookmarkFolder, unbookmarkFolder as apiUnbookmarkFolder } from "../../lib/foldersApi";
import { getMyProfile } from "../../lib/profileApi.js";
import { setUserDepartment } from "../../lib/departments.js";
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
import SubTabBar from "./SubTabBar.jsx";
import EmptyState from "./EmptyState.jsx";
import LoadingState from "./LoadingState.jsx";
import ErrorState from "./ErrorState.jsx";
import "../../research-hub.css";

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
  const [communitySubTab, setCommunitySubTab] = useState("all");
  const [toast, setToast] = useState(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarkFolderMap, setBookmarkFolderMap] = useState({});
  const [bookmarkBusyId, setBookmarkBusyId] = useState(null);
  const [showBookmarkPicker, setShowBookmarkPicker] = useState(false);
  const [bookmarkTarget, setBookmarkTarget] = useState(null);
  const [filters, setFilters] = useState({ university: "all", department: "all", level: "all", semester: "all", subject: "all" });
  const [userProfile, setUserProfile] = useState(null);
  const [fsrsStats, setFsrsStats] = useState(null);
  const [fsrsAnalytics, setFsrsAnalytics] = useState(null);
  const [viewerInitialPage, setViewerInitialPage] = useState(null);

  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [wizardPresetFolderId, setWizardPresetFolderId] = useState(null);
  const [showFab, setShowFab] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [folders, setFolders] = useState({ own: [], shared: [], bookmarked: [] });
  const [folderBookmarkedIds, setFolderBookmarkedIds] = useState(new Set());
  const [folderBookmarkBusyId, setFolderBookmarkBusyId] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderDetail, setFolderDetail] = useState(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCourseCode, setNewFolderCourseCode] = useState("");
  const [newFolderVisibility, setNewFolderVisibility] = useState("private");
  const [newFolderLevel, setNewFolderLevel] = useState("");
  const [newFolderSemester, setNewFolderSemester] = useState("");
  const [newFolderDeptIds, setNewFolderDeptIds] = useState([]);
  const [userDept, setUserDept] = useState(null);
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
      if (data?.userDept) setUserDept(data.userDept);
    } catch {}
  };

  useEffect(() => {
    const handler = (e) => {
      const tab = e.detail?.tab;
      if (tab === "space" || tab === "fsrs" || tab === "progress") {
        setActiveTab("library");
      } else if (tab === "department") {
        setActiveTab("community");
        setCommunitySubTab("department");
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
        setActiveTab("community");
        setCommunitySubTab("department");
      } else if (tab) {
        setActiveTab(tab);
      }
      window.__sc_pending_hub_tab = null;
    }
  }, []);

  useEffect(() => {
    if (activeTab === "library" || (activeTab === "community" && communitySubTab === "department")) {
      fetchBookmarks();
    }
  }, [activeTab, communitySubTab]);

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
      const data = await listFolders();
      setFolders(data);
      const bmIds = new Set((data.bookmarked || []).map((f) => f.id));
      setFolderBookmarkedIds(bmIds);
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
    if (newFolderVisibility === "shared" && newFolderDeptIds.length === 0) {
      showToast("Please select a department to share with");
      return;
    }
    try {
      // If user had no department and selected one, persist it
      if (newFolderVisibility === "shared" && !userDept?.departmentId && newFolderDeptIds.length > 0) {
        const yearLevel = newFolderLevel ? parseInt(newFolderLevel) : 1;
        const safeYearLevel = isNaN(yearLevel) ? 1 : yearLevel;
        const semester = newFolderSemester || null;
        try {
          await setUserDepartment(newFolderDeptIds[0], safeYearLevel, semester, userProfile?.universityId || null);
          fetchUserProfile();
        } catch {}
      }

      const data = await createFolder({
        name: newFolderName.trim(),
        courseCode: newFolderCourseCode.trim() || null,
        visibility: newFolderVisibility,
        level: newFolderLevel || null,
        semester: newFolderSemester || null,
        universityId: userProfile?.universityId || null,
        departmentIds: newFolderVisibility === "shared" ? newFolderDeptIds : undefined,
      });
      setFolders((prev) => ({ ...prev, own: [data, ...(prev.own || [])] }));
      setShowCreateFolder(false);
      setNewFolderName(""); setNewFolderCourseCode(""); setNewFolderVisibility("private");
      setNewFolderLevel(""); setNewFolderSemester("");
      setNewFolderDeptIds([]);
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

  const handleToggleFolderBookmark = useCallback(async (folder) => {
    if (!folder?.id) return;
    const isBookmarked = folderBookmarkedIds.has(folder.id);
    setFolderBookmarkBusyId(folder.id);
    // Optimistic update
    setFolderBookmarkedIds((prev) => {
      const next = new Set(prev);
      if (isBookmarked) next.delete(folder.id);
      else next.add(folder.id);
      return next;
    });
    try {
      if (isBookmarked) {
        await apiUnbookmarkFolder(folder.id);
        showToast("Removed from your space");
      } else {
        await apiBookmarkFolder(folder.id);
        showToast("Added to your space ★");
      }
      fetchFolders();
    } catch {
      // Revert on error
      setFolderBookmarkedIds((prev) => {
        const next = new Set(prev);
        if (isBookmarked) next.add(folder.id);
        else next.delete(folder.id);
        return next;
      });
      showToast("Failed to update bookmark");
    } finally {
      setFolderBookmarkBusyId(null);
    }
  }, [folderBookmarkedIds]);

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

  const handleWizardCreateFolder = async (name, courseCode) => {
    try {
      const data = await createFolder({
        name,
        courseCode: courseCode || null,
        visibility: "private",
        universityId: userProfile?.universityId || null,
      });
      setFolders((prev) => ({ ...prev, own: [data, ...(prev.own || [])] }));
      showToast("Space created ✓");
      return data;
    } catch (err) {
      showToast(err.message || "Failed to create space");
      throw err;
    }
  };

  const handleWizardFileUpload = (data) => {
    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("subject", data.subject);
    formData.append("contentType", data.contentType);
    formData.append("isPremium", "false");
    formData.append("isPublic", data.isPublic ? "true" : "false");
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
        setUploadError("");
        showToast("Saved to space ✓");
        if (data.folderId) { fetchFolderDetail(data.folderId); }
        else { fetchResources(); fetchFolders(); }
      } else {
        let errMsg = "Upload failed — please try again";
        try { const err = JSON.parse(xhr.responseText); if (err.error) errMsg = err.error; } catch {}
        setUploadError(errMsg);
        showToast(errMsg);
      }
    });
    xhr.addEventListener("error", () => {
      setUploading(false);
      setUploadError("Network error — check your connection and try again");
      showToast("Network error — check your connection");
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
    body.isPublic = data.isPublic !== undefined ? data.isPublic : true;

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
        setUploadError("");
        try { localStorage.removeItem("sc_resources_list"); } catch {}
        setResources((prev) => [resource, ...prev]);
        setShowUploadWizard(false);
        showToast("Saved to space ✓");
        if (data.folderId) { fetchFolderDetail(data.folderId); }
        else { fetchResources(); fetchFolders(); }
      })
      .catch((err) => {
        setUploading(false);
        const errMsg = err.message || "Failed to save — try again";
        setUploadError(errMsg);
        showToast(errMsg);
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
      uploadError={uploadError}
      onClearUploadError={() => setUploadError("")}
      onCreateFolder={handleWizardCreateFolder}
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
      userDept={userDept}
      newFolderDeptIds={newFolderDeptIds} setNewFolderDeptIds={setNewFolderDeptIds}
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
        onToggleFolderBookmark={handleToggleFolderBookmark}
        folderBookmarkedIds={folderBookmarkedIds}
        folderBookmarkBusyId={folderBookmarkBusyId}
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
    <div className="mx-auto max-w-[1200px] p-4 sm:p-6">
      <div className="mc-sticky-header -mx-4 mb-6 px-4 sm:-mx-6 sm:px-6">
        <div className="flex flex-col items-center pt-2 text-center">
          <h1 className="text-gradient-gold text-2xl font-extrabold tracking-tight sm:text-3xl">My Circle</h1>
          <p className="mt-1 text-[13px] text-hub-text-dim">Your personal study circle</p>
        </div>
        <div className="sc-tabrow flex justify-center gap-2 overflow-x-auto pb-2 pt-3">
        {[["library", "📚 My Space"], ["community", "🌐 Community"]].map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)} className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-all active:scale-95 ${
            activeTab === key
              ? "border border-gold-border bg-gold-dim font-bold text-gold"
              : "border border-hub-border bg-hub-bg text-hub-text-dim hover:bg-hub-surface-hover hover:text-hub-text-muted"
          }`}>
            {label}
            {key === "library" && fsrsStats && fsrsStats.dueCount > 0 && (
              <span className="due-pulse rounded-full border border-coral-300 bg-coral-100 px-2 py-0.5 text-[10px] font-bold text-coral-400">{fsrsStats.dueCount}</span>
            )}
          </button>
        ))}
      </div>
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
          folderBookmarkedIds={folderBookmarkedIds}
          folderBookmarkBusyId={folderBookmarkBusyId}
          onToggleFolderBookmark={handleToggleFolderBookmark}
        />
      ) : (
        <>
          <SubTabBar
            tabs={[
              ["all", "All Resources"],
              ["department", "🏛️ My Department", folders?.shared?.length || 0],
            ]}
            activeTab={communitySubTab}
            onTabChange={setCommunitySubTab}
          />

          {communitySubTab === "department" ? (
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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex min-h-[40px] flex-1 items-center gap-3 rounded-full border border-hub-border bg-hub-bg px-4 py-2">
              <span className="text-lg text-hub-text-dim">🔍</span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, PDFs, MCQs…"
                className="flex-1 border-none bg-none text-sm text-hub-text outline-none placeholder:text-hub-text-dim" />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className="min-h-[40px] rounded-lg border border-hub-border bg-hub-bg px-3 py-2 text-[12px] text-hub-text outline-none cursor-pointer">
              <option value="recent">Most recent</option>
              <option value="views">Most viewed</option>
              <option value="bookmarks">Most saved</option>
            </select>
          </div>

          <FilterBar filters={filters} setFilters={setFilters} resources={communityResources} />

          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {filterTypes.map((type) => (
              <button key={type} onClick={() => setActiveFilter(type)} className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${
                activeFilter === type
                  ? "border border-gold-border bg-gold-dim text-gold"
                  : "border border-hub-border bg-hub-bg text-hub-text-muted"
              }`}>
                {filterLabels[type]}
              </button>
            ))}
          </div>

          <div className="mb-4 text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">Community</div>

          {resourcesLoading ? (
            <LoadingState grid count={4} />
          ) : resourcesError ? (
            <ErrorState message={resourcesError} onRetry={fetchResources} />
          ) : visibleResources.length === 0 ? (
            <EmptyState icon="📭" title="No results" message={emptyMessages["public"]} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visibleResources.map((resource, i) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  isBookmarked={bookmarkedIds.has(resource.id)}
                  bookmarkBusy={bookmarkBusyId === resource.id}
                  onOpen={handleOpen}
                  onToggleBookmark={toggleBookmark}
                  onShare={handleShare}
                  mcqProgress={mcqProgress}
                  index={i}
                />
              ))}
            </div>
          )}
            </>
          )}
        </>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-[1001] flex -translate-x-1/2 items-center gap-2 rounded-full border border-gold-border bg-hub-surface px-4 py-2.5 text-[13px] font-semibold text-gold shadow-lg" style={{ animation: "fade-up 0.2s ease both" }}>
          <span>✓</span>{toast}
        </div>
      )}

      {showFab && (activeTab === "library" || (activeTab === "community" && communitySubTab === "department")) && (
        <div onClick={() => setShowFab(false)} className="fixed inset-0 z-[998] bg-black/50" style={{ animation: "fade-up 0.15s ease" }} />
      )}

      <div className="fixed bottom-20 right-6 z-[999] flex flex-col items-end gap-3">
        {showFab && (activeTab === "library" || (activeTab === "community" && communitySubTab === "department")) && (
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
        {(activeTab === "library" || (activeTab === "community" && communitySubTab === "department")) && (
        <button
          onClick={() => setShowFab((v) => !v)}
          className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-gold text-3xl font-bold transition-all duration-200 active:scale-90"
          style={{
            background: showFab ? "#141414" : "linear-gradient(135deg, #FFD700, #DAA520, #B8860B)",
            boxShadow: showFab ? "0 4px 16px rgba(0,0,0,0.4)" : "0 8px 28px rgba(255,215,0,0.45), 0 2px 8px rgba(0,0,0,0.3)",
            color: showFab ? "#FFD700" : "#0a0a0a",
            transform: showFab ? "rotate(45deg)" : "rotate(0deg)",
            cursor: "pointer",
          }}
        >
          +
        </button>
        )}
      </div>

      {uploadWizard}
      {createFolderModal}
      {bookmarkPicker}
    </div>
  );
}

function FabAction({ icon, label, subtitle, onClick }) {
  return (
    <div onClick={onClick} className="flex cursor-pointer items-center gap-3" style={{ animation: "fabslide 0.2s ease" }}>
      <div className="rounded-xl border border-gold-border bg-hub-surface px-3.5 py-2 text-right shadow-lg">
        <div className="whitespace-nowrap text-[13px] font-bold text-gold">{label}</div>
        <div className="whitespace-nowrap text-[10px] text-hub-text-dim">{subtitle}</div>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gold-border bg-gold-dim text-xl">
        {icon}
      </div>
    </div>
  );
}
