import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { copyShareToken } from "../../lib/researchUtils";
import { listFolders, listCommunityFolders, createFolder, getFolder, deleteFolder as apiDeleteFolder, bookmarkFolder as apiBookmarkFolder, unbookmarkFolder as apiUnbookmarkFolder } from "../../lib/foldersApi";
import { getMyProfile } from "../../lib/profileApi.js";
import { setUserDepartment } from "../../lib/departments.js";
import ResourceViewer from "../ResourceViewer";
import { useUserData } from "../../contexts/UserDataContext";

import ResourceCard from "./ResourceCard";
import MaterialCard from "./MaterialCard.jsx";
import { categorizeResources } from "./lib/categorize.js";
import FilterBar from "./FilterBar";
import FolderDetailView from "./FolderDetailView";
import UploadWizard from "./UploadWizard";
import BookmarkSpacePicker from "./BookmarkSpacePicker";
import CreateFolderModal from "./CreateFolderModal";
import LibraryView from "./LibraryView.jsx";
import DepartmentView from "./DepartmentView.jsx";
import SubTabBar from "./SubTabBar.jsx";
import EmptyState from "./EmptyState.jsx";
import { FolderCard } from "./FolderGrid.jsx";
import LoadingState from "./LoadingState.jsx";
import ErrorState from "./ErrorState.jsx";
import SpacedReviewSession from "../SpacedReviewSession.jsx";
import AdaptiveDrillSession from "../AdaptiveDrillSession.jsx";
import ExamSimulationRunner from "../ExamSimulationRunner.jsx";
import McqFolderRunner from "../McqFolderRunner.jsx";
import { useMaterialGenerate } from "./useMaterialGenerate.js";
import "../../research-hub.css";

const API_BASE = import.meta.env.VITE_API_BASE || import.meta.env.VITE_API_BASE_URL || "https://scholars-circle-production.up.railway.app";
const CACHE_TTL = 5 * 60 * 1000;

const communityTabs = [
  { key: "folders", label: "Folders", icon: "📁", color: "#8B5CF6" },
  { key: "materials", label: "Materials", icon: "📄", color: "#F5A623" },
  { key: "pdf", label: "PDF", icon: "📕", color: "#EF4444" },
  { key: "mcq", label: "MCQ", icon: "✎", color: "#3DD68C" },
  { key: "flashcard", label: "Flashcard", icon: "🎴", color: "#4F8EF7" },
];

const communityEmptyStates = {
  materials: { icon: "📄", title: "No materials yet", message: "Be the first to share study materials for your course." },
  pdf: { icon: "📕", title: "No PDFs found", message: "Try adjusting your filters or search." },
  mcq: { icon: "✎", title: "No MCQ sets yet", message: "Generate MCQs from a material or upload your own." },
  flashcard: { icon: "🎴", title: "No flashcard decks yet", message: "Generate flashcards from a material or upload your own." },
  folders: { icon: "📁", title: "No shared folders yet", message: "When teachers create shared folders, they'll appear here for you to bookmark." },
};

const emptyMessages = {
  "public": "No resources found. Try a different search or clear filters.",
};

export default function ResearchHub({ onBack, onStreakUpdate, onXpUpdate, activeSemester } = {}) {
  const { setLastActivity } = useUserData();

  const [resources, setResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(true);
  const [resourcesError, setResourcesError] = useState(null);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("folders");
  const [sortBy, setSortBy] = useState("recent");
  const [folderFilter, setFolderFilter] = useState("all"); // all | my-uni | my-dept | trending
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
  const [communityFolders, setCommunityFolders] = useState([]);
  const [activeFolder, setActiveFolder] = useState(null);
  const [folderDetail, setFolderDetail] = useState(null);
  const [folderLoading, setFolderLoading] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderCourseCode, setNewFolderCourseCode] = useState("");
  const [newFolderVisibility, setNewFolderVisibility] = useState("link");
  const [newFolderLevel, setNewFolderLevel] = useState("");
  const [newFolderSemester, setNewFolderSemester] = useState("");
  const [newFolderDeptIds, setNewFolderDeptIds] = useState([]);
  const [userDept, setUserDept] = useState(null);
  const [activeFolderTab, setActiveFolderTab] = useState("materials");
  const [mcqProgress, setMcqProgress] = useState({});
  const [sessionMode, setSessionMode] = useState(null); // { type: 'spaced'|'adaptive'|'exam'|'folder', subject, resourceIds, folder, mcqResources }

  const { generatingId, genProgress, genError: materialGenError, genErrorId: materialGenErrorId, generate: generateFromMaterial, retry: retryMaterialGenerate, clearError: clearMaterialGenError } = useMaterialGenerate();

  useEffect(() => {
    fetchResources();
    fetchFsrsStats();
    fetchFsrsAnalytics();
    fetchFolders();
    fetchCommunityFolders();
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
      if (e.detail?.folderId) {
        setTimeout(() => openFolder(e.detail.folderId), 300);
      }
      if (e.detail?.openUpload) {
        setTimeout(() => openUpload(), 300);
      }
      if (e.detail?.openCreateFolder) {
        setTimeout(() => setShowCreateFolder(true), 300);
      }
    };
    window.addEventListener("sc-open-research-hub", handler);
    return () => window.removeEventListener("sc-open-research-hub", handler);
  }, []);

  useEffect(() => {
    if (window.__sc_pending_hub_tab) {
      const { tab, subTab, openUpload, openCreateFolder } = window.__sc_pending_hub_tab;
      if (tab === "space" || tab === "fsrs" || tab === "progress") {
        setActiveTab("library");
      } else if (tab === "department") {
        setActiveTab("community");
        setCommunitySubTab("department");
      } else if (tab) {
        setActiveTab(tab);
      }
      if (openUpload) {
        setTimeout(() => openUpload(), 300);
      }
      if (openCreateFolder) {
        setTimeout(() => setShowCreateFolder(true), 300);
      }
      window.__sc_pending_hub_tab = null;
    }
  }, []);

  useEffect(() => {
    if (activeTab === "library" || activeTab === "community") {
      fetchBookmarks();
    }
    if (activeTab === "community") {
      fetchCommunityFolders();
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

  const fetchCommunityFolders = async (searchTerm) => {
    try {
      const data = await listCommunityFolders(searchTerm);
      setCommunityFolders(data);
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
        showToast("Removed folder + resources from your space");
      } else {
        const result = await apiBookmarkFolder(folder.id);
        const count = result?.resourcesBookmarked;
        showToast(count > 0 ? `Folder + ${count} resources added to your space ✓` : "Folder added to your space ✓");
      }
      fetchFolders();
      fetchCommunityFolders();
      fetchBookmarks();
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

  const FILE_TYPES = ["pdf", "docx", "pptx", "txt", "image", "doc", "note", "tutorial_question"];

  const folderCategorized = useMemo(() => {
    const sourceFiles = [];
    const standaloneItems = [];
    const derivedBySource = {};

    for (const r of folderResources) {
      if (r.sourceResourceId) {
        if (!derivedBySource[r.sourceResourceId]) derivedBySource[r.sourceResourceId] = [];
        derivedBySource[r.sourceResourceId].push(r);
      }
    }

    for (const r of folderResources) {
      if (r.sourceResourceId) continue;

      if (FILE_TYPES.includes(r.contentType)) {
        const derived = derivedBySource[r.id] || [];
        const variants = { summary: null, mcq: null, flashcard: null };
        for (const d of derived) {
          if (d.contentType === "mcq") variants.mcq = d;
          else if (d.contentType === "flashcard_deck") variants.flashcard = d;
          else if (d.contentType === "pdf" && d.fileName?.startsWith("[AI] Summary")) variants.summary = d;
          else if (d.contentType === "pdf" && d.description && d.title === r.title) variants.summary = d;
        }
        sourceFiles.push({ ...r, variants, standalone: false });
      } else if (r.contentType === "mcq") {
        standaloneItems.push({ ...r, variants: { summary: null, mcq: r, flashcard: null }, standalone: true });
      } else if (r.contentType === "flashcard_deck") {
        standaloneItems.push({ ...r, variants: { summary: null, mcq: null, flashcard: r }, standalone: true });
      } else if (r.contentType === "pdf" && r.title?.startsWith("[AI] Summary")) {
        standaloneItems.push({ ...r, variants: { summary: r, mcq: null, flashcard: null }, standalone: true });
      } else {
        sourceFiles.push({ ...r, variants: { summary: null, mcq: null, flashcard: null }, standalone: false });
      }
    }

    const allItems = [...sourceFiles, ...standaloneItems];

    const summaryCount = allItems.filter(f => f.variants.summary).length;
    const flashcardCount = allItems.filter(f => f.variants.flashcard).length;
    const mcqCount = allItems.filter(f => f.variants.mcq).length;

    const allMcqs = allItems.filter(f => f.variants.mcq).map(f => f.variants.mcq);

    return {
      materials: sourceFiles,
      summaries: allItems.filter(f => f.variants.summary),
      flashcards: allItems.filter(f => f.variants.flashcard),
      mcqs: allItems.filter(f => f.variants.mcq),
      allMcqResources: allMcqs,
      counts: {
        materials: sourceFiles.length,
        summaries: summaryCount,
        flashcards: flashcardCount,
        mcqs: mcqCount,
      },
    };
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
    if (onXpUpdate && data.xpAwarded > 0) onXpUpdate(data.xpAwarded);
  }, [onStreakUpdate, onXpUpdate]);

  const handleSessionComplete = useCallback(() => {
    setSessionMode(null);
    fetchFsrsStats(); fetchFsrsAnalytics();
    fetchMcqProgress();
  }, []);

  const handleStreakUpdate = useCallback((streak, longestStreak) => {
    if (onStreakUpdate) onStreakUpdate(streak, longestStreak);
  }, [onStreakUpdate]);

  const handleXpUpdate = useCallback((xp) => {
    if (onXpUpdate) onXpUpdate(xp);
  }, [onXpUpdate]);

  const startSpacedReview = useCallback((subject, resourceIds) => {
    setSessionMode({ type: "spaced", subject, resourceIds });
  }, []);

  const startAdaptiveDrill = useCallback((subject, resourceIds) => {
    setSessionMode({ type: "adaptive", subject, resourceIds });
  }, []);

  const startExamSimulation = useCallback((subject, resourceIds) => {
    setSessionMode({ type: "exam", subject, resourceIds });
  }, []);

  const startFolderPractice = useCallback((folder, mcqResources) => {
    setSessionMode({ type: "folder", folder, mcqResources });
  }, []);

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
    // Collect derived resource IDs for optimistic bundle update
    const derivedIds = (resource.derivedResources || []).map((r) => r.id);
    const allIds = [resource.id, ...derivedIds];
    if (isBookmarked) {
      // Unbookmark directly — no picker needed
      setBookmarkBusyId(resource.id);
      const prevIds = bookmarkedIds;
      setBookmarkedIds((prev) => {
        const next = new Set(prev);
        allIds.forEach((id) => next.delete(id));
        return next;
      });
      setBookmarkFolderMap((prev) => {
        const next = { ...prev };
        allIds.forEach((id) => delete next[id]);
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
    const derivedIds = (resource.derivedResources || []).map((r) => r.id);
    const allIds = [resource.id, ...derivedIds];
    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      allIds.forEach((id) => next.add(id));
      return next;
    });
    if (folderId) {
      setBookmarkFolderMap((prev) => {
        const next = { ...prev };
        allIds.forEach((id) => { next[id] = folderId; });
        return next;
      });
    }
    try {
      const res = await fetch(`${API_BASE}/api/resources/${resource.id}/bookmark`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folderId || null }),
      });
      if (res.ok) {
        const hasDerived = derivedIds.length > 0;
        showToast(folderId ? (hasDerived ? "Added material + MCQs + Flashcards to space ✓" : "Added to space ✓") : (hasDerived ? "Added material + MCQs + Flashcards to your space ✓" : "Added to your space ✓"));
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

  const handleWizardFileUpload = async (data) => {
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

    // Simulate progress since fetch() doesn't support upload progress events
    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 5, 90));
    }, 300);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    try {
      const response = await fetch(`${API_BASE}/api/resources`, {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
        signal: controller.signal,
      });

      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      setUploadProgress(100);
      setUploading(false);

      if (!response.ok) {
        let errMsg = "Upload failed — please try again";
        try { const err = await response.json(); if (err.error) errMsg = err.error; } catch {}
        setUploadError(errMsg);
        showToast(errMsg);
        return;
      }

      const resource = await response.json();
      if (resource.status === "approved") {
        try { localStorage.removeItem("sc_resources_list"); } catch {}
        setResources((prev) => [resource, ...prev]);
      }
      setShowUploadWizard(false);
      setUploadError("");
      showToast("Saved to space ✓");
      if (data.folderId) { fetchFolderDetail(data.folderId); }
      else { fetchResources(); fetchFolders(); }
    } catch (err) {
      clearInterval(progressInterval);
      clearTimeout(timeoutId);
      setUploading(false);
      console.error("[upload] fetch error:", err);
      const msg = err.name === "AbortError"
        ? "Upload timed out after 60s — check your connection and try again"
        : err.message === "Failed to fetch"
        ? "Network error — check your connection and try again"
        : (err.message || "Upload failed");
      setUploadError(msg);
      showToast(msg);
    }
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
    if (data.sourceResourceId) body.sourceResourceId = data.sourceResourceId;
    body.isPublic = data.isPublic !== undefined ? data.isPublic : true;

    const authData = JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
    const token = authData.authToken;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    fetch(`${API_BASE}/api/resources/study-tool-save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
      .then((res) => {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("Failed to save");
        return res.json();
      })
      .then((resource) => {
        setUploadError("");
        try { localStorage.removeItem("sc_resources_list"); } catch {}
        setResources((prev) => [resource, ...prev]);
        if (data.folderId) { fetchFolderDetail(data.folderId); }
        else { fetchResources(); fetchFolders(); }
        if (data.isSecondary) {
          setUploading(false);
          setShowUploadWizard(false);
          showToast("Saved MCQs + Flashcards to space ✓");
        } else if (data.contentType === "mcq" && !data.isSecondary) {
          // First save of combined MCQs+Flashcards — don't reset uploading, second save will follow
        } else {
          setUploading(false);
          const toastMsg = data.contentType === "mcq" ? "MCQs saved to space ✓"
            : data.contentType === "flashcard_deck" ? "Flashcards saved to space ✓"
            : data.contentType === "pdf" ? "Summary saved to space ✓"
            : "Saved to space ✓";
          showToast(toastMsg);
        }
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        setUploading(false);
        const errMsg = err.name === "AbortError"
          ? "Save timed out after 60s — check your connection and try again"
          : (err.message || "Failed to save — try again");
        setUploadError(errMsg);
        showToast(errMsg);
      });
  };

  useEffect(() => {
    if (materialGenError) {
      showToast(materialGenError);
    }
  }, [materialGenError]);

  const handleStudyWithVoice = useCallback((resource) => {
    window.dispatchEvent(new CustomEvent("sc-open-voice-tutor", { detail: { resourceId: resource.id } }));
  }, []);

  const handleGenerateFromMaterial = useCallback((resource, kind) => {
    let existingMcqData = null;
    if (resource.variants?.mcq?.mcqData) {
      try {
        const parsed = typeof resource.variants.mcq.mcqData === "string"
          ? JSON.parse(resource.variants.mcq.mcqData)
          : resource.variants.mcq.mcqData;
        if (Array.isArray(parsed) && parsed.length > 0) {
          existingMcqData = parsed;
        }
      } catch {}
    }
    generateFromMaterial(resource, kind, handleWizardStudyToolSave, existingMcqData);
  }, [generateFromMaterial, handleWizardStudyToolSave]);

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
      const matchesUni = filters.university === "all" || r.university?.name === filters.university;
      const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
      const matchesLevel = filters.level === "all" || r.level === filters.level;
      const matchesSemester = filters.semester === "all" || r.semester === filters.semester;
      const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
      return matchesSearch && matchesUni && matchesDept && matchesLevel && matchesSemester && matchesSubject;
    });
    if (list.length === 0 && filters.semester !== "all" && (tabResources || []).length > 0) {
      list = (tabResources || []).filter((r) => {
        const matchesSearch = search === "" || r.title.toLowerCase().includes(search.toLowerCase()) || r.subject.toLowerCase().includes(search.toLowerCase());
        const matchesUni = filters.university === "all" || r.university?.name === filters.university;
        const matchesDept = filters.department === "all" || r.department === filters.department || (r.resourceDepts && r.resourceDepts.some((rd) => rd.department.name === filters.department));
        const matchesLevel = filters.level === "all" || r.level === filters.level;
        const matchesSubject = filters.subject === "all" || r.subject === filters.subject;
        return matchesSearch && matchesUni && matchesDept && matchesLevel && matchesSubject;
      });
    }
    const sorted = [...list];
    // Priority sort: same university + same level first, then same university, then same level
    const userUniId = userProfile?.universityId || userProfile?.university?.id;
    const userLevel = userProfile?.level;
    if (userUniId || userLevel) {
      sorted.sort((a, b) => {
        const aSameUni = userUniId && a.universityId && String(a.universityId) === String(userUniId);
        const bSameUni = userUniId && b.universityId && String(b.universityId) === String(userUniId);
        const aSameLevel = userLevel && a.level === userLevel;
        const bSameLevel = userLevel && b.level === userLevel;
        const aTier = (aSameUni && aSameLevel) ? 1 : aSameUni ? 2 : aSameLevel ? 3 : 4;
        const bTier = (bSameUni && bSameLevel) ? 1 : bSameUni ? 2 : bSameLevel ? 3 : 4;
        if (aTier !== bTier) return aTier - bTier;
        if (sortBy === "views") return (b.viewCount || 0) - (a.viewCount || 0);
        if (sortBy === "bookmarks") return (b._count?.bookmarks || 0) - (a._count?.bookmarks || 0);
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } else {
      if (sortBy === "views") sorted.sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
      else if (sortBy === "recent") sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      else if (sortBy === "bookmarks") sorted.sort((a, b) => (b._count?.bookmarks || 0) - (a._count?.bookmarks || 0));
    }
    return sorted;
  }, [tabResources, search, filters, sortBy, userProfile]);

  // Compute relevance tier per resource for badges + section headers
  const resourceTiers = useMemo(() => {
    const userUniId = userProfile?.universityId || userProfile?.university?.id;
    const userLevel = userProfile?.level;
    const tierMap = {};
    for (const r of visibleResources) {
      const sameUni = userUniId && r.universityId && String(r.universityId) === String(userUniId);
      const sameLevel = userLevel && r.level === userLevel;
      tierMap[r.id] = (sameUni && sameLevel) ? 1 : sameUni ? 2 : sameLevel ? 3 : 4;
    }
    return tierMap;
  }, [visibleResources, userProfile]);

  // Categorize community resources for the new tab system
  const communityCategorized = useMemo(() => {
    if (activeTab !== "community") return { materials: [], pdfs: [], mcqs: [], flashcards: [], counts: { materials: 0, pdf: 0, mcq: 0, flashcard: 0 } };
    const cats = categorizeResources(visibleResources);
    const pdfs = cats.materials.filter((r) => r.contentType === "pdf");
    return {
      materials: cats.materials,
      pdfs,
      mcqs: cats.mcqs,
      flashcards: cats.flashcards,
      counts: {
        materials: cats.materials.length,
        pdf: pdfs.length,
        mcq: cats.mcqs.length,
        flashcard: cats.flashcards.length,
      },
    };
  }, [visibleResources, activeTab]);

  // Filter + group community folders
  const communityFolderSections = useMemo(() => {
    const userUniId = userProfile?.universityId || userProfile?.university?.id;
    const userDeptId = userDept?.departmentId;
    const arr = [...communityFolders];

    // Apply filter
    let filtered = arr;
    if (folderFilter === "my-uni") {
      filtered = arr.filter((f) => f.university?.id && String(f.university.id) === String(userUniId));
    } else if (folderFilter === "my-dept") {
      filtered = arr.filter((f) => (f.folderDepts || []).some((fd) => String(fd.department?.id) === String(userDeptId)));
    } else if (folderFilter === "trending") {
      filtered = arr.filter((f) => (f._count?.folderBookmarks || 0) >= 3);
    }

    // Sort by bookmarks desc, then recent
    filtered.sort((a, b) => {
      const bmDiff = (b._count?.folderBookmarks || 0) - (a._count?.folderBookmarks || 0);
      if (bmDiff !== 0) return bmDiff;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    // Group into sections (only for "all" filter)
    if (folderFilter === "all" && userUniId) {
      const fromUni = filtered.filter((f) => f.university?.id && String(f.university.id) === String(userUniId));
      const popular = filtered.filter((f) => (f._count?.folderBookmarks || 0) >= 5 && !(f.university?.id && String(f.university.id) === String(userUniId)));
      const fromUniIds = new Set(fromUni.map((f) => f.id));
      const popularIds = new Set(popular.map((f) => f.id));
      const more = filtered.filter((f) => !fromUniIds.has(f.id) && !popularIds.has(f.id));

      return [
        ...(fromUni.length > 0 ? [{ label: "From Your University", folders: fromUni }] : []),
        ...(popular.length > 0 ? [{ label: "Popular", folders: popular }] : []),
        ...(more.length > 0 ? [{ label: "More Folders", folders: more }] : []),
      ];
    }

    return [{ label: null, folders: filtered }];
  }, [communityFolders, folderFilter, userProfile, userDept]);

  // Group resources by tier for section headers
  const communitySections = useMemo(() => {
    if (activeTab !== "community" || activeFilter !== "materials") return [];
    const sections = [
      { tier: 1, label: "From your university", items: [] },
      { tier: 2, label: null, items: [] }, // merged with tier 1
      { tier: 3, label: "Your level, other schools", items: [] },
      { tier: 4, label: "More from the community", items: [] },
    ];
    for (const r of communityCategorized.materials) {
      const tier = resourceTiers[r.id] || 4;
      if (tier === 1 || tier === 2) sections[0].items.push(r);
      else if (tier === 3) sections[2].items.push(r);
      else sections[3].items.push(r);
    }
    return sections.filter((s) => s.items.length > 0);
  }, [communityCategorized, resourceTiers, activeTab, activeFilter]);

  const uploadWizard = (
    <UploadWizard
      show={showUploadWizard}
      onClose={closeUploadWizard}
      folders={folders}
      presetFolderId={wizardPresetFolderId}
      userProfile={userProfile}
      onUploadFile={handleWizardFileUpload}
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

  if (sessionMode) {
    if (sessionMode.type === "spaced") {
      return <SpacedReviewSession subject={sessionMode.subject} resourceIds={sessionMode.resourceIds} onBack={handleSessionComplete} onStreakUpdate={handleStreakUpdate} onXpUpdate={handleXpUpdate} />;
    }
    if (sessionMode.type === "adaptive") {
      return <AdaptiveDrillSession subject={sessionMode.subject} resourceIds={sessionMode.resourceIds} onBack={handleSessionComplete} onStreakUpdate={handleStreakUpdate} onXpUpdate={handleXpUpdate} />;
    }
    if (sessionMode.type === "exam") {
      return <ExamSimulationRunner subject={sessionMode.subject} resourceIds={sessionMode.resourceIds} onBack={handleSessionComplete} onStreakUpdate={handleStreakUpdate} onXpUpdate={handleXpUpdate} />;
    }
    if (sessionMode.type === "folder") {
      return <McqFolderRunner folder={sessionMode.folder} mcqResources={sessionMode.mcqResources} onBack={handleSessionComplete} onStreakUpdate={handleStreakUpdate} onXpUpdate={handleXpUpdate} />;
    }
  }

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} initialPage={viewerInitialPage} onBack={() => { setViewerToken(null); setViewerInitialPage(null); }} onQuizComplete={handleQuizComplete} onStreakUpdate={handleStreakUpdate} onXpUpdate={handleXpUpdate} />;
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
        onSpacedReview={(resourceIds) => startSpacedReview(null, resourceIds)}
        onAdaptiveDrill={(resourceIds) => startAdaptiveDrill(null, resourceIds)}
        onExamSimulation={(resourceIds) => startExamSimulation(null, resourceIds)}
        onPracticeAll={() => startFolderPractice(folderDetail, folderCategorized.allMcqResources)}
        onGenerate={handleGenerateFromMaterial}
        onStudyWithVoice={handleStudyWithVoice}
        generatingId={generatingId}
        genProgress={genProgress}
        genErrorId={materialGenErrorId}
        genError={materialGenError}
        onRetry={retryMaterialGenerate}
        onDismissGenError={clearMaterialGenError}
        uploadModal={uploadWizard}
        createFolderModal={createFolderModal}
        bookmarkPicker={bookmarkPicker}
        onStartStudying={(topicCtx) => {
          const detail = {
            topic: topicCtx.title || (typeof topicCtx === "string" ? topicCtx : ""),
            mode: "auto-roadmap",
            context: typeof topicCtx === "object" ? topicCtx : null,
          };
          window.dispatchEvent(new CustomEvent("sc-open-study", { detail }));
        }}
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
          {/* Sticky search + sort row */}
          <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-hub-border bg-hub-surface/95 px-3 py-2.5 backdrop-blur">
            <div className="flex min-h-[40px] flex-1 items-center gap-3 rounded-full border border-hub-border bg-hub-bg px-4 py-2">
              <span className="text-lg text-hub-text-dim">🔍</span>
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search materials, MCQs, flashcards…"
                className="flex-1 border-none bg-none text-sm text-hub-text outline-none placeholder:text-hub-text-dim" />
            </div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
              className={`min-h-[40px] rounded-lg border border-hub-border bg-hub-bg px-3 py-2 text-[12px] text-hub-text outline-none cursor-pointer ${activeFilter === "folders" ? "hidden" : ""}`}>
              <option value="recent">Most recent</option>
              <option value="views">Most viewed</option>
              <option value="bookmarks">Most saved</option>
            </select>
          </div>

          <FilterBar filters={filters} setFilters={setFilters} resources={communityResources} />

          {/* Segmented control — Materials / PDF / MCQ / Flashcard */}
          <div className="mb-6 flex gap-1 rounded-xl border border-hub-border bg-hub-bg p-1">
            {communityTabs.map((tab) => {
              const count = tab.key === "folders" ? communityFolders.length : (communityCategorized.counts[tab.key] || 0);
              const isActive = activeFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-[11px] font-bold transition-all active:scale-95 ${
                    isActive ? "bg-hub-surface text-hub-text" : "text-hub-text-muted hover:text-hub-text"
                  }`}
                  style={isActive ? { boxShadow: `inset 0 -2px 0 ${tab.color}` } : {}}
                >
                  <span className="text-base">{tab.icon}</span>
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className="text-[9px] font-semibold" style={{ color: tab.color, fontFamily: "'JetBrains Mono', monospace" }}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeFilter === "folders" ? (
            <>
              {/* Filter pills */}
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { key: "all", label: "All", icon: "📋" },
                  { key: "my-uni", label: "My University", icon: "🏫" },
                  { key: "my-dept", label: "My Department", icon: "🏛️" },
                  { key: "trending", label: "Trending", icon: "🔥" },
                ].map((pill) => (
                  <button
                    key={pill.key}
                    onClick={() => setFolderFilter(pill.key)}
                    className={`rounded-full px-4 py-1.5 text-[12px] font-semibold transition-all active:scale-95 ${
                      folderFilter === pill.key
                        ? "bg-gold text-[#0a0a0a]"
                        : "border border-hub-border bg-hub-surface text-hub-text-muted hover:text-hub-text"
                    }`}
                  >
                    {pill.icon} {pill.label}
                  </button>
                ))}
              </div>

              {communityFolderSections.length === 0 || communityFolderSections.every((s) => s.folders.length === 0) ? (
                <EmptyState icon={communityEmptyStates.folders.icon} title={communityEmptyStates.folders.title} message={communityEmptyStates.folders.message} />
              ) : (
                <div className="space-y-6">
                  {communityFolderSections.map((section, si) => (
                    <div key={si}>
                      {section.label && (
                        <div className="mb-3 flex items-center gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">{section.label}</span>
                          <span className="h-px flex-1 bg-hub-border" />
                        </div>
                      )}
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {section.folders.map((folder, i) => (
                          <FolderCard
                            key={folder.id}
                            folder={folder}
                            shared
                            onClick={() => openFolder(folder.id)}
                            index={i}
                            isBookmarked={folderBookmarkedIds.has(folder.id)}
                            bookmarkBusy={folderBookmarkBusyId === folder.id}
                            onToggleBookmark={handleToggleFolderBookmark}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : resourcesLoading ? (
            <LoadingState grid count={4} />
          ) : resourcesError ? (
            <ErrorState message={resourcesError} onRetry={fetchResources} />
          ) : activeFilter === "materials" ? (
            communityCategorized.materials.length === 0 ? (
              <EmptyState icon={communityEmptyStates.materials.icon} title={communityEmptyStates.materials.title} message={communityEmptyStates.materials.message} />
            ) : (
              <div className="space-y-6">
                {communitySections.map((section, si) => (
                  <div key={si}>
                    {section.label && (
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">{section.label}</span>
                        <span className="h-px flex-1 bg-hub-border" />
                      </div>
                    )}
                    <div className="cs-grid grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(310px, 1fr))" }}>
                      {section.items.map((file, i) => (
                        <MaterialCard
                          key={file.id}
                          file={file}
                          isBookmarked={bookmarkedIds.has(file.id)}
                          bookmarkBusy={bookmarkBusyId === file.id}
                          onOpen={handleOpen}
                          onToggleBookmark={toggleBookmark}
                          onShare={handleShare}
                          onGenerate={handleGenerateFromMaterial}
                          generatingId={generatingId}
                          genProgress={genProgress}
                          index={i}
                          showBookmark={true}
                          relevanceTier={resourceTiers[file.id] || null}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : activeFilter === "pdf" ? (
            communityCategorized.pdfs.length === 0 ? (
              <EmptyState icon={communityEmptyStates.pdf.icon} title={communityEmptyStates.pdf.title} message={communityEmptyStates.pdf.message} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {communityCategorized.pdfs.map((resource, i) => (
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
                    relevanceTier={resourceTiers[resource.id] || null}
                  />
                ))}
              </div>
            )
          ) : activeFilter === "mcq" ? (
            communityCategorized.mcqs.length === 0 ? (
              <EmptyState icon={communityEmptyStates.mcq.icon} title={communityEmptyStates.mcq.title} message={communityEmptyStates.mcq.message} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {communityCategorized.mcqs.map((item, i) => {
                  const variant = item.variants?.mcq;
                  const mcqRes = variant ? { ...item, ...variant, derivedResources: undefined } : item;
                  return (
                    <ResourceCard
                      key={mcqRes.id}
                      resource={mcqRes}
                      isBookmarked={bookmarkedIds.has(mcqRes.id)}
                      bookmarkBusy={bookmarkBusyId === mcqRes.id}
                      onOpen={handleOpen}
                      onToggleBookmark={toggleBookmark}
                      onShare={handleShare}
                      mcqProgress={mcqProgress}
                      index={i}
                      relevanceTier={resourceTiers[item.id] || null}
                    />
                  );
                })}
              </div>
            )
          ) : activeFilter === "flashcard" ? (
            communityCategorized.flashcards.length === 0 ? (
              <EmptyState icon={communityEmptyStates.flashcard.icon} title={communityEmptyStates.flashcard.title} message={communityEmptyStates.flashcard.message} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {communityCategorized.flashcards.map((item, i) => {
                  const variant = item.variants?.flashcard;
                  const fcRes = variant ? { ...item, ...variant, derivedResources: undefined } : item;
                  return (
                    <ResourceCard
                      key={fcRes.id}
                      resource={fcRes}
                      isBookmarked={bookmarkedIds.has(fcRes.id)}
                      bookmarkBusy={bookmarkBusyId === fcRes.id}
                      onOpen={handleOpen}
                      onToggleBookmark={toggleBookmark}
                      onShare={handleShare}
                      mcqProgress={mcqProgress}
                      index={i}
                      relevanceTier={resourceTiers[item.id] || null}
                    />
                  );
                })}
              </div>
            )
          ) : null}
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
        <div onClick={() => setShowFab(false)} className="mc-fab-overlay fixed inset-0 z-[998] bg-black/50" style={{ animation: "fade-up 0.15s ease" }} />
      )}

      <div className="mc-fab-container fixed bottom-24 right-6 z-[999] flex flex-col items-end gap-3">
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
          className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-gold text-2xl font-bold transition-all duration-200 active:scale-90"
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
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-border bg-gold-dim text-lg">
        {icon}
      </div>
    </div>
  );
}
