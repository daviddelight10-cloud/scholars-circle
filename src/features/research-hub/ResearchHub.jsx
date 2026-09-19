import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createLiveRoom } from "../live-quiz/liveQuizApi.js";
import { copyShareToken } from "../../lib/researchUtils";
import { listFolders, listCommunityFolders, createFolder, getFolder, deleteFolder as apiDeleteFolder, restoreFolder as apiRestoreFolder, purgeFolder as apiPurgeFolder, getRecycleBin, bookmarkFolder as apiBookmarkFolder, unbookmarkFolder as apiUnbookmarkFolder, updateFolder as apiUpdateFolder, updateFolderBookmark as apiUpdateFolderBookmark } from "../../lib/foldersApi";
import { submitReport } from "../../lib/reportsApi.js";
import { getMyProfile } from "../../lib/profileApi.js";
import { setUserDepartment } from "../../lib/departments.js";
import { haptics } from "../../lib/haptics";
import { usePullToRefresh } from "../../lib/usePullToRefresh";
import ResourceViewer from "../ResourceViewer";
import { useUserData } from "../../contexts/UserDataContext";

import { categorizeResources } from "./lib/categorize.js";
import FolderDetailView from "./FolderDetailView";
import UploadWizard from "./UploadWizard";
import BookmarkSpacePicker from "./BookmarkSpacePicker";
import CreateFolderModal from "./CreateFolderModal";
import LibraryView from "./LibraryView.jsx";
import EmptyState from "./EmptyState.jsx";
import LoadingState from "./LoadingState.jsx";
import ErrorState from "./ErrorState.jsx";
import SpacedReviewSession from "../SpacedReviewSession.jsx";
import AdaptiveDrillSession from "../AdaptiveDrillSession.jsx";
import ExamSimulationRunner from "../ExamSimulationRunner.jsx";
import McqFolderRunner from "../McqFolderRunner.jsx";
import McIcon from "./McIcon.jsx";
import CircleSheet from "./CircleSheet.jsx";
import CardActionSheet from "./CardActionSheet.jsx";
import ReportSheet from "./ReportSheet.jsx";
import ProfileSheet from "./ProfileSheet.jsx";
import RecycleBinSheet from "./RecycleBinSheet.jsx";
import CommunityFolderCard from "./CommunityFolderCard.jsx";
import PdfCard from "./PdfCard.jsx";
import { useMaterialGenerate, extractResourceText } from "./useMaterialGenerate.js";
import { getGuidedProgressIndex } from "../../lib/studyCache.js";
import "../../research-hub.css";

const CACHE_TTL = 5 * 60 * 1000;

const TYPE_OPTIONS = [
  { value: "folders", label: "Folders" },
  { value: "pdf", label: "PDFs" },
];

const communityEmptyStates = {
  pdf: { icon: "📕", title: "No PDFs found", message: "Try adjusting your filters or search." },
  folders: { icon: "📁", title: "No shared folders yet", message: "When teachers create shared folders, they'll appear here for you to bookmark." },
};

const ownerDisplayName = (f) =>
  f.owner?.lecturerProfile?.fullName || f.owner?.userProfile?.fullName || f.owner?.username || "";

const folderMatchesSearch = (f, q) => {
  const hay = [f.name, f.courseCode].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
};

const ownerMatchesSearch = (f, q) => {
  return (ownerDisplayName(f) || "").toLowerCase().includes(q);
};

/** Gizmo-style dropdown filter pill — collapsed label, opens a small menu. */
function FilterPill({ label, value, options, onChange, allLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDoc);
    return () => document.removeEventListener("pointerdown", onDoc);
  }, [open]);

  const active = value !== "all";
  const current = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} className="mc-fpill-wrap">
      <button className={`mc-fpill${active ? " active" : ""}`} onClick={() => setOpen((v) => !v)}>
        {active ? current : label}
        <McIcon name="chev" size={11} />
      </button>
      {open && (
        <div className="mc-fmenu">
          <button className={!active ? "active" : ""} onClick={() => { onChange("all"); setOpen(false); }}>
            {allLabel || `All ${label.toLowerCase()}`}
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              className={value === o.value ? "active" : ""}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResearchHub({ onBack, onStreakUpdate, onXpUpdate, activeSemester } = {}) {
  const { setLastActivity } = useUserData();
  const navigate = useNavigate();

  const [resources, setResources] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_resources_list");
      if (raw) {
        const { data } = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch {}
    return [];
  });
  const [resourcesLoading, setResourcesLoading] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_resources_list");
      if (raw) {
        const { ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) return false;
      }
    } catch {}
    return true;
  });
  const [resourcesError, setResourcesError] = useState(null);
  const [search, setSearch] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("library");
  const [communityType, setCommunityType] = useState("all"); // all | folders | pdf
  const activeQuery = activeTab === "library" ? librarySearch : search;
  const setActiveQuery = activeTab === "library" ? setLibrarySearch : setSearch;
  const [recycleItems, setRecycleItems] = useState([]);
  const [recycleBinBusyId, setRecycleBinBusyId] = useState(null);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState(null); // { id, name, kind, type, shareToken }
  const [showReport, setShowReport] = useState(false);
  const [profileOwner, setProfileOwner] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // own space pending soft delete
  const [toast, setToast] = useState(null); // { msg, icon, actLabel, actFn }
  const toastTimer = useRef(null);
  const [viewerToken, setViewerToken] = useState(null);
  const [bookmarkedIds, setBookmarkedIds] = useState(new Set());
  const [bookmarkFolderMap, setBookmarkFolderMap] = useState({});
  const [bookmarkBusyId, setBookmarkBusyId] = useState(null);
  const [showBookmarkPicker, setShowBookmarkPicker] = useState(false);
  const [bookmarkTarget, setBookmarkTarget] = useState(null);
  const [filters, setFilters] = useState({ university: "all", department: "all", level: "all", semester: "all", subject: "all" });
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_user_profile");
      if (raw) { const { data } = JSON.parse(raw); return data?.profile || null; }
    } catch {}
    return null;
  });
  const [fsrsStats, setFsrsStats] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_fsrs_stats");
      if (raw) { const { data } = JSON.parse(raw); return data; }
    } catch {}
    return null;
  });

  const [viewerInitialPage, setViewerInitialPage] = useState(null);

  const [showUploadWizard, setShowUploadWizard] = useState(false);
  const [wizardPresetFolderId, setWizardPresetFolderId] = useState(null);
  const [showFab, setShowFab] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const [folders, setFolders] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_folders");
      if (raw) { const { data } = JSON.parse(raw); return data || { own: [], shared: [], bookmarked: [] }; }
    } catch {}
    return { own: [], shared: [], bookmarked: [] };
  });
  const [folderBookmarkedIds, setFolderBookmarkedIds] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_folders");
      if (raw) { const { data } = JSON.parse(raw); return new Set((data?.bookmarked || []).map((f) => f.id)); }
    } catch {}
    return new Set();
  });
  const [folderBookmarkBusyId, setFolderBookmarkBusyId] = useState(null);
  const [communityFolders, setCommunityFolders] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_community_folders");
      if (raw) { const { data } = JSON.parse(raw); if (Array.isArray(data)) return data; }
    } catch {}
    return [];
  });
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
  const [mcqProgress, setMcqProgress] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_mcq_progress");
      if (raw) { const { data } = JSON.parse(raw); return data || {}; }
    } catch {}
    return {};
  });
  const [guidedProgress, setGuidedProgress] = useState(() => {
    try {
      const raw = localStorage.getItem("sc_guided_progress_index");
      if (raw) return JSON.parse(raw) || {};
    } catch {}
    return {};
  });
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
    fetchGuidedProgress();
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    const cacheKey = "sc_user_profile";
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) {
          if (data?.profile) setUserProfile(data.profile);
          if (data?.userDept) setUserDept(data.userDept);
        }
      }
    } catch {}
    try {
      const data = await getMyProfile();
      if (data?.profile) setUserProfile(data.profile);
      if (data?.userDept) setUserDept(data.userDept);
      try { localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() })); } catch {}
    } catch {}
  };

  const refreshAll = useCallback(async () => {
    haptics.medium();
    await Promise.all([
      fetchResources(),
      fetchFsrsStats(),
      fetchFsrsAnalytics(),
      fetchFolders(),
      fetchCommunityFolders(),
      fetchBookmarks(),
      fetchMcqProgress(),
      fetchGuidedProgress(),
    ]);
  }, []);

  const ptr = usePullToRefresh(refreshAll);

  useEffect(() => {
    const handler = (e) => {
      const tab = e.detail?.tab;
      if (tab === "space" || tab === "fsrs" || tab === "progress") {
        setActiveTab("library");
      } else if (tab === "department") {
        setActiveTab("community");
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
      const { tab, openUpload, openCreateFolder } = window.__sc_pending_hub_tab;
      if (tab === "space" || tab === "fsrs" || tab === "progress") {
        setActiveTab("library");
      } else if (tab === "department") {
        setActiveTab("community");
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
  }, [activeTab]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

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

  const loadCached = (key) => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch {}
    return null;
  };

  const saveCached = (key, data) => {
    try { localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() })); } catch {}
  };

  const fetchBookmarks = async () => {
    const cacheKey = "sc_bookmarks";
    const cached = loadCached(cacheKey);
    if (cached) {
      setBookmarkedIds(new Set(cached.map((r) => r.id)));
      const folderMap = {};
      for (const r of cached) {
        if (r.bookmarkFolderId) folderMap[r.id] = r.bookmarkFolderId;
      }
      setBookmarkFolderMap(folderMap);
    }
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
        saveCached(cacheKey, data);
      }
    } catch {}
  };

  const fetchFsrsStats = async () => {
    const cacheKey = "sc_fsrs_stats";
    const cached = loadCached(cacheKey);
    if (cached) setFsrsStats(cached);
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/stats`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setFsrsStats(data);
        saveCached(cacheKey, data);
      }
    } catch {}
  };

  // Warms the sc_fsrs_analytics cache for Home/RetentionDashboard
  const fetchFsrsAnalytics = async () => {
    const cacheKey = "sc_fsrs_analytics";
    try {
      const res = await fetch(`${API_BASE}/api/resources/fsrs/analytics?days=30`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        saveCached(cacheKey, data);
      }
    } catch {}
  };

  const fetchFolders = async () => {
    const cacheKey = "sc_folders";
    const cached = loadCached(cacheKey);
    if (cached) {
      setFolders(cached);
      setFolderBookmarkedIds(new Set((cached.bookmarked || []).map((f) => f.id)));
    }
    try {
      const data = await listFolders();
      setFolders(data);
      const bmIds = new Set((data.bookmarked || []).map((f) => f.id));
      setFolderBookmarkedIds(bmIds);
      saveCached(cacheKey, data);
    } catch {}
  };

  const fetchCommunityFolders = async (searchTerm) => {
    const cacheKey = "sc_community_folders";
    if (!searchTerm) {
      const cached = loadCached(cacheKey);
      if (cached) setCommunityFolders(cached);
    }
    try {
      const data = await listCommunityFolders(searchTerm);
      setCommunityFolders(data);
      if (!searchTerm) saveCached(cacheKey, data);
    } catch {}
  };

  const fetchGuidedProgress = async () => {
    setGuidedProgress(await getGuidedProgressIndex());
  };

  const fetchMcqProgress = async () => {
    const cacheKey = "sc_mcq_progress";
    const cached = loadCached(cacheKey);
    if (cached) setMcqProgress(cached);
    try {
      const res = await fetch(`${API_BASE}/api/resources/my-mcq-progress`, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setMcqProgress(data);
        saveCached(cacheKey, data);
      }
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

  // Set a course code on the open folder — owners edit the folder itself;
  // non-owners get a personal code on their bookmark (auto-bookmarking first
  // if they haven't saved the space yet).
  const handleSetFolderCourseCode = async (code) => {
    if (!folderDetail) return;
    if (folderIsOwner) {
      await apiUpdateFolder(folderDetail.id, { courseCode: code });
    } else {
      if (!folderBookmarkedIds.has(folderDetail.id)) {
        const res = await apiBookmarkFolder(folderDetail.id);
        setFolderBookmarkedIds((prev) => new Set(prev).add(folderDetail.id));
        if (res?.skeletonCloned > 0) showToast("Roadmap included — check the Topics tab");
      }
      await apiUpdateFolderBookmark(folderDetail.id, code);
    }
    await fetchFolderDetail(folderDetail.id);
  };

  const showToast = (message, opts = {}) => {
    setToast({ msg: message, icon: opts.icon || "check", actLabel: opts.actLabel || null, actFn: opts.actFn || null });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), opts.actLabel ? 4500 : 2400);
  };

  const dismissToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToast(null);
  }, []);

  const runToastAction = useCallback(() => {
    const fn = toast?.actFn;
    dismissToast();
    if (fn) fn();
  }, [toast, dismissToast]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) { showToast("Folder name required"); return; }
    haptics.medium();
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
    if (!confirm("Move this folder to the Recycle Bin? You can restore it for 30 days.")) return;
    try {
      await apiDeleteFolder(folderId);
      setFolders((prev) => ({ ...prev, own: (prev.own || []).filter((f) => f.id !== folderId) }));
      if (activeFolder === folderId) { setActiveFolder(null); setFolderDetail(null); }
      fetchRecycleBinData();
      showToast("Folder moved to the Recycle Bin", { icon: "trash" });
    } catch {
      showToast("Failed to delete folder");
    }
  };

  // ── Recycle bin (30-day soft delete) ──────────────────────────────────
  const fetchRecycleBinData = useCallback(async () => {
    try {
      const items = await getRecycleBin();
      setRecycleItems(Array.isArray(items) ? items : []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRecycleBinData();
  }, [fetchRecycleBinData]);

  const openRecycleBin = useCallback(() => {
    fetchRecycleBinData();
    setRecycleBinOpen(true);
  }, [fetchRecycleBinData]);

  const openProfile = useCallback((owner) => {
    haptics.light();
    setProfileOwner(owner);
  }, []);

  const requestSpaceDelete = useCallback((folder) => {
    haptics.medium();
    setDeleteTarget(folder);
  }, []);

  const confirmSpaceDelete = async () => {
    const folder = deleteTarget;
    setDeleteTarget(null);
    if (!folder) return;
    try {
      await apiDeleteFolder(folder.id);
      setFolders((prev) => ({ ...prev, own: (prev.own || []).filter((f) => f.id !== folder.id) }));
      fetchRecycleBinData();
      showToast(`"${folder.name}" moved to bin`, {
        icon: "trash",
        actLabel: "Undo",
        actFn: async () => {
          try {
            await apiRestoreFolder(folder.id);
            setFolders((prev) => ({ ...prev, own: [folder, ...(prev.own || [])] }));
            fetchRecycleBinData();
          } catch {
            showToast("Failed to restore folder");
          }
        },
      });
    } catch (err) {
      showToast(err.message || "Failed to delete folder");
    }
  };

  const handleRestoreTrash = async (item) => {
    setRecycleBinBusyId(item.id);
    try {
      const restored = await apiRestoreFolder(item.id);
      setFolders((prev) => ({ ...prev, own: [restored, ...(prev.own || [])] }));
      setRecycleItems((prev) => prev.filter((t) => t.id !== item.id));
      showToast(`Restored "${item.name}"`, { icon: "check" });
    } catch {
      showToast("Failed to restore folder");
    } finally {
      setRecycleBinBusyId(null);
    }
  };

  const handlePurgeTrash = async (item) => {
    setRecycleBinBusyId(item.id);
    try {
      await apiPurgeFolder(item.id);
      setRecycleItems((prev) => prev.filter((t) => t.id !== item.id));
      showToast("Deleted forever", { icon: "trash" });
    } catch {
      showToast("Failed to delete folder");
    } finally {
      setRecycleBinBusyId(null);
    }
  };

  // ── Card actions (⋮): share / copy link / report ─────────────────────
  const openCardActions = useCallback((item) => {
    const isFolder = item.visibility != null;
    setActionTarget({
      id: item.id,
      name: isFolder ? item.name : item.title,
      kind: isFolder ? "Folder" : "PDF document",
      type: isFolder ? "folder" : "resource",
      shareToken: item.shareToken,
    });
  }, []);

  const cardActionUrl = (t) => {
    if (!t) return window.location.origin;
    return t.type === "folder"
      ? `${window.location.origin}/folders/${t.shareToken || ""}`
      : `${window.location.origin}/resources/${t.shareToken || ""}`;
  };

  const handleActionShare = async () => {
    const t = actionTarget;
    setActionTarget(null);
    if (!t) return;
    const url = cardActionUrl(t);
    try {
      if (navigator.share) {
        await navigator.share({ title: t.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        showToast("Link copied to clipboard", { icon: "link" });
      }
    } catch {
      // user cancelled share — no-op
    }
  };

  const handleActionCopyLink = async () => {
    const t = actionTarget;
    setActionTarget(null);
    if (!t) return;
    try {
      await navigator.clipboard.writeText(cardActionUrl(t));
      showToast("Link copied to clipboard", { icon: "link" });
    } catch {
      showToast("Could not copy link");
    }
  };

  const handleActionReport = () => {
    if (!actionTarget) return;
    setShowReport(true);
  };

  const handleReportSubmit = async ({ target, reason, note }) => {
    try {
      await submitReport({ targetType: target.type, targetId: target.id, reason, note });
      setActionTarget(null);
      setShowReport(false);
      showToast("Report received — our team will review it. Thank you!", { icon: "check" });
    } catch (err) {
      showToast(err.message || "Failed to submit report");
      throw err;
    }
  };

  const handleShareFolder = async (folder) => {
    if (!folder?.shareToken) { showToast("Share not available"); return; }
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
    haptics.light();
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
        const cloned = result?.skeletonCloned > 0;
        showToast(
          cloned
            ? "Folder + roadmap added to your space ✓"
            : count > 0
              ? `Folder + ${count} resources added to your space ✓`
              : "Folder added to your space ✓"
        );
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
      haptics.light();
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
      haptics.selection();
      setBookmarkTarget(resource);
      setShowBookmarkPicker(true);
    }
  }, [bookmarkedIds]);

  const handleBookmarkWithFolder = useCallback(async (resource, folderId) => {
    haptics.success();
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
    const timeoutId = setTimeout(() => controller.abort(), 300_000);

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
        ? "Upload timed out after 5min — check your connection and try again"
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
    const timeoutId = setTimeout(() => controller.abort(), 300_000);

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
          ? "Save timed out after 5min — check your connection and try again"
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

  const canDeleteFile = useCallback((file) => {
    const uid = getCurrentUserId();
    if (!uid || !file) return false;
    if (String(file.uploadedBy) === uid) return true;
    const role = userProfile?.role;
    return role === "TEACHER" || role === "LECTURER";
  }, [userProfile]);

  const handleRenameResource = useCallback(async (file) => {
    if (!file?.id) return;
    const next = prompt("Rename file", file.title);
    if (next === null) return;
    const title = next.trim();
    if (!title || title === file.title) return;
    try {
      const res = await fetch(`${API_BASE}/api/resources/${file.id}`, {
        method: "PATCH",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Rename failed");
      }
      showToast("Renamed");
      if (activeFolder) fetchFolderDetail(activeFolder);
      fetchResources();
    } catch (err) {
      showToast(err.message || "Rename failed");
    }
  }, [activeFolder]);

  const handleDeleteResource = useCallback(async (file) => {
    if (!file?.id) return;
    if (!confirm(`Permanently delete "${file.title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/resources/${file.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete file");
      }
      showToast("File deleted");
      if (activeFolder) fetchFolderDetail(activeFolder);
      fetchResources();
    } catch (err) {
      showToast(err.message || "Failed to delete file");
    }
  }, [activeFolder]);

  const [preparingStudy, setPreparingStudy] = useState(false);

  const handleGuidedStudy = useCallback(async (file) => {
    if (!file || preparingStudy) return;
    setPreparingStudy(true);
    try {
      const { text } = await extractResourceText(file);
      const content = (text || "").trim();
      if (!content) { showToast("Couldn't extract text from this file"); return; }
      window.dispatchEvent(new CustomEvent("sc-open-study", {
        detail: {
          topic: file.title,
          mode: "auto-roadmap",
          attachment: { name: file.fileName || file.title, content },
          context: { resourceId: file.id, matches: [{ title: file.title, contentType: file.contentType }] },
        },
      }));
    } catch (err) {
      showToast(err.message || "Couldn't prepare guided study");
    } finally {
      setPreparingStudy(false);
    }
  }, [preparingStudy]);

  const [goingLive, setGoingLive] = useState(false);

  const handleGoLive = useCallback(async (file) => {
    const mcq = file?.variants?.mcq;
    if (!mcq || goingLive) return;
    setGoingLive(true);
    try {
      const res = await createLiveRoom(mcq.id);
      navigate(`/live/${res.code}`, { state: { ticket: res.ticket, roomId: res.roomId } });
    } catch (err) {
      showToast(err.message || "Couldn't start live session");
    } finally {
      setGoingLive(false);
    }
  }, [goingLive, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

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
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    } else {
      sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    }
    return sorted;
  }, [tabResources, search, filters, userProfile]);

  // Categorize community resources (PDFs for the community tab)
  const communityCategorized = useMemo(() => {
    if (activeTab !== "community") return { pdfs: [], counts: { pdf: 0 } };
    const cats = categorizeResources(visibleResources);
    const pdfs = cats.materials.filter((r) => r.contentType === "pdf");
    return {
      pdfs,
      counts: { pdf: pdfs.length },
    };
  }, [visibleResources, activeTab]);

  // Lecturer-owned folders (YOUR LECTURERS section)
  const lecturerFolderList = useMemo(() => {
    return communityFolders.filter((f) => f.owner?.role === "LECTURER" || f.owner?.role === "TEACHER");
  }, [communityFolders]);

  // PDFs for the community tab (visibleResources already applies search + filter pills)
  const communityPdfs = communityCategorized.pdfs;

  // Filter + group community folders (non-lecturer, searched/filter-pilled)
  const communityFolderSections = useMemo(() => {
    const userUniId = userProfile?.universityId || userProfile?.university?.id;
    const arr = communityFolders.filter((f) => !(f.owner?.role === "LECTURER" || f.owner?.role === "TEACHER"));

    let filtered = arr;
    if (search) {
      const q = search.toLowerCase();
      filtered = arr.filter((f) => folderMatchesSearch(f, q));
    }
    if (filters.university !== "all") {
      filtered = filtered.filter((f) => f.university?.name === filters.university);
    }
    if (filters.level !== "all") {
      filtered = filtered.filter((f) => f.level === filters.level);
    }

    // Sort by bookmarks desc, then recent
    filtered = [...filtered].sort((a, b) => {
      const bmDiff = (b._count?.folderBookmarks || 0) - (a._count?.folderBookmarks || 0);
      if (bmDiff !== 0) return bmDiff;
      return new Date(b.updatedAt) - new Date(a.updatedAt);
    });

    const filtersActive = search || filters.university !== "all" || filters.level !== "all" || filters.subject !== "all";
    // Group into sections (only when browsing unfiltered)
    if (!filtersActive && userUniId) {
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
  }, [communityFolders, filters, search, userProfile]);

  // Lecturers section (searched/filter-pilled)
  const lecturerSections = useMemo(() => {
    let filtered = lecturerFolderList;
    if (search) {
      const q = search.toLowerCase();
      filtered = lecturerFolderList.filter((f) => folderMatchesSearch(f, q) || ownerMatchesSearch(f, q));
    }
    if (filters.university !== "all") {
      filtered = filtered.filter((f) => f.university?.name === filters.university);
    }
    if (filters.level !== "all") {
      filtered = filtered.filter((f) => f.level === filters.level);
    }
    return [...filtered].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [lecturerFolderList, filters, search]);

  // People matches (folders owned by people whose name matches the search)
  const peopleMatches = useMemo(() => {
    if (!search) return [];
    const q = search.toLowerCase();
    return communityFolders.filter((f) => ownerMatchesSearch(f, q) && !folderMatchesSearch(f, q));
  }, [communityFolders, search]);

  // Search result counts for the results bar
  const searchCounts = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    const folders = communityFolders.filter((f) => folderMatchesSearch(f, q));
    const pdfs = communityPdfs.filter((r) =>
      (r.title || "").toLowerCase().includes(q) || (r.subject || "").toLowerCase().includes(q)
    );
    const people = peopleMatches.length;
    return { all: folders.length + pdfs.length + people, folders: folders.length, pdfs: pdfs.length, people };
  }, [search, communityFolders, communityPdfs, peopleMatches]);

  // Filtered PDF list (search + filters already applied upstream)
  const visiblePdfs = communityPdfs;

  // Filter-pill option lists (levels + schools seen in the community feed)
  const levelOptions = useMemo(() => {
    const set = new Set();
    tabResources.forEach((r) => r.level && set.add(r.level));
    communityFolders.forEach((f) => f.level && set.add(f.level));
    return Array.from(set).sort();
  }, [tabResources, communityFolders]);

  const schoolOptions = useMemo(() => {
    const set = new Set();
    tabResources.forEach((r) => r.university?.name && set.add(r.university.name));
    communityFolders.forEach((f) => f.university?.name && set.add(f.university.name));
    return Array.from(set).sort();
  }, [tabResources, communityFolders]);

  // Folders owned by the profile-sheet subject
  const profileFolders = useMemo(() => {
    if (!profileOwner) return [];
    return communityFolders.filter((f) => f.owner?.id === profileOwner.id);
  }, [communityFolders, profileOwner]);

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
        guidedProgress={guidedProgress}
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
        onGuidedStudy={handleGuidedStudy}
        onGoLive={handleGoLive}
        onSetCourseCode={handleSetFolderCourseCode}
        preparingStudy={preparingStudy}
        onDeleteResource={handleDeleteResource}
        onRenameResource={handleRenameResource}
        canDeleteFile={canDeleteFile}
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
    <div ref={ptr.ref} className="ptr-container mc-root mx-auto max-w-[1200px] p-4 sm:p-6">
      <div style={ptr.indicatorStyle} className="ptr-indicator">
        {ptr.showSpinner ? (
          <div className="ptr-spinner" />
        ) : (
          <span className="ptr-arrow" style={{ transform: `rotate(${ptr.pullDistance > ptr.THRESHOLD ? 180 : 0}deg)` }}>↓</span>
        )}
        <span>{ptr.isRefreshing ? "Refreshing…" : "Pull to refresh"}</span>
      </div>
      <div className="mc-sticky-header -mx-4 mb-4 px-4 sm:-mx-6 sm:px-6">
        <div className="mc-toprow">
          <div className="mc-tabs">
            <button className={activeTab === "library" ? "active" : ""} onClick={() => setActiveTab("library")}>
              My Space
              {fsrsStats && fsrsStats.dueCount > 0 && (
                <span className="mc-count">{fsrsStats.dueCount}</span>
              )}
            </button>
            <button className={activeTab === "community" ? "active" : ""} onClick={() => setActiveTab("community")}>
              Community
            </button>
          </div>
          <div className="mc-top-pills">
            <button
              className={`mc-search-toggle${searchOpen || activeQuery ? " on" : ""}`}
              aria-label={searchOpen ? "Close search" : "Search"}
              onClick={() => {
                if (searchOpen) { setActiveQuery(""); setSearchOpen(false); }
                else setSearchOpen(true);
              }}
            >
              <McIcon name={searchOpen ? "x" : "search"} size={14} />
            </button>
          </div>
        </div>
        {(searchOpen || activeQuery) && (
          <div className="mc-search mc-search-anim">
            <span className="mc-s-ic"><McIcon name="search" /></span>
            <input
              ref={searchInputRef}
              type="text"
              value={activeQuery}
              onChange={(e) => setActiveQuery(e.target.value)}
              placeholder={activeTab === "library" ? "Search your spaces…" : "Search materials, people, course codes…"}
            />
            {activeQuery && (
              <button className="mc-s-clear" aria-label="Clear search" onClick={() => setActiveQuery("")}>
                <McIcon name="x" size={13} />
              </button>
            )}
          </div>
        )}
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
          onOpenRecycleBin={openRecycleBin}
          recycleCount={recycleItems.length}
          onRequestDeleteSpace={requestSpaceDelete}
          search={librarySearch}
          fsrsStats={fsrsStats}
        />
      ) : (
        <div className="mc-root">
          {/* Filter pills */}
          <div className="mc-fpills">
            <FilterPill
              label="Type"
              value={communityType}
              onChange={setCommunityType}
              options={TYPE_OPTIONS}
              allLabel="All types"
            />
            {levelOptions.length > 0 && (
              <FilterPill
                label="Level"
                value={filters.level}
                onChange={(v) => setFilters((f) => ({ ...f, level: v }))}
                options={levelOptions.map((l) => ({ value: l, label: l }))}
                allLabel="All levels"
              />
            )}
            {subjects.length > 0 && (
              <FilterPill
                label="Subject"
                value={filters.subject}
                onChange={(v) => setFilters((f) => ({ ...f, subject: v }))}
                options={subjects.map((s) => ({ value: s, label: s }))}
                allLabel="All subjects"
              />
            )}
            {schoolOptions.length > 0 && (
              <FilterPill
                label="School"
                value={filters.university}
                onChange={(v) => setFilters((f) => ({ ...f, university: v }))}
                options={schoolOptions.map((s) => ({ value: s, label: s }))}
                allLabel="All schools"
              />
            )}
          </div>

          {/* University banner */}
          {!search && communityType !== "pdf" && userProfile?.university?.name && (
            <div className="mc-uni-banner">
              <McIcon name="flame" />
              <span>Popular at <b>{userProfile.university.name}</b></span>
            </div>
          )}

          {/* Results count */}
          {search && searchCounts && (
            <div className="mc-results-line"><b>{searchCounts.all}</b> results for "{search}"</div>
          )}

          <div className="mc-content">
            {search ? (
                  <>
                    {communityType !== "pdf" && (communityFolderSections[0]?.folders || []).length > 0 && (
                      <>
                        <div className="mc-section-label">FOLDERS</div>
                        <div className="mc-folders-grid">
                          {communityFolderSections[0].folders.map((folder, i) => (
                            <CommunityFolderCard
                              key={folder.id}
                              folder={folder}
                              index={i}
                              onClick={() => openFolder(folder.id)}
                              isBookmarked={folderBookmarkedIds.has(folder.id)}
                              bookmarkBusy={folderBookmarkBusyId === folder.id}
                              onToggleBookmark={handleToggleFolderBookmark}
                              onOpenProfile={openProfile}
                              onOpenActions={openCardActions}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {communityType !== "pdf" && peopleMatches.length > 0 && (
                      <>
                        <div className="mc-section-label">PEOPLE</div>
                        <div className="mc-folders-grid">
                          {peopleMatches.map((folder, i) => (
                            <CommunityFolderCard
                              key={folder.id}
                              folder={folder}
                              index={i}
                              onClick={() => openFolder(folder.id)}
                              isBookmarked={folderBookmarkedIds.has(folder.id)}
                              bookmarkBusy={folderBookmarkBusyId === folder.id}
                              onToggleBookmark={handleToggleFolderBookmark}
                              onOpenProfile={openProfile}
                              onOpenActions={openCardActions}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {communityType !== "folders" && visiblePdfs.length > 0 && (
                      <>
                        <div className="mc-section-label">PDF DOCUMENTS</div>
                        <div className="mc-pdfs-grid">
                          {visiblePdfs.map((resource) => (
                            <PdfCard
                              key={resource.id}
                              resource={resource}
                              isBookmarked={bookmarkedIds.has(resource.id)}
                              bookmarkBusy={bookmarkBusyId === resource.id}
                              onOpen={(r) => handleOpen(r.shareToken)}
                              onToggleBookmark={toggleBookmark}
                              onOpenActions={openCardActions}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    {searchCounts && searchCounts.all === 0 && (
                      <div className="mc-search-empty">
                        <McIcon name="search" />
                        <b>No results for "{search}"</b>
                        <p>
                          Try a course code like <span className="mc-code">PHY 201</span>,<br />
                          a person's name, or a subject.
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Folders */}
                    {communityType !== "pdf" && (
                      <>
                        {communityFolderSections.every((s) => s.folders.length === 0) ? (
                          <EmptyState
                            icon={communityEmptyStates.folders.icon}
                            title={communityEmptyStates.folders.title}
                            message={communityEmptyStates.folders.message}
                          />
                        ) : (
                          communityFolderSections.map((section, si) => (
                            <div key={section.label || si}>
                              {section.label && (
                                <div className="mc-section-label">{section.label.toUpperCase()}</div>
                              )}
                              <div className="mc-folders-grid">
                                {section.folders.map((folder, i) => (
                                  <CommunityFolderCard
                                    key={folder.id}
                                    folder={folder}
                                    index={i}
                                    onClick={() => openFolder(folder.id)}
                                    isBookmarked={folderBookmarkedIds.has(folder.id)}
                                    bookmarkBusy={folderBookmarkBusyId === folder.id}
                                    onToggleBookmark={handleToggleFolderBookmark}
                                    onOpenProfile={openProfile}
                                    onOpenActions={openCardActions}
                                  />
                                ))}
                              </div>
                            </div>
                          ))
                        )}

                        {/* Lecturers section */}
                        {lecturerSections.length > 0 && (
                          <>
                            <div className="mc-section-label">YOUR LECTURERS</div>
                            <p className="mc-section-hint">
                              Folders uploaded directly by your course lecturers. Tap a name to view their profile.
                            </p>
                            <div className="mc-folders-grid">
                              {lecturerSections.map((folder, i) => (
                                <CommunityFolderCard
                                  key={folder.id}
                                  folder={folder}
                                  index={i}
                                  onClick={() => openFolder(folder.id)}
                                  isBookmarked={folderBookmarkedIds.has(folder.id)}
                                  bookmarkBusy={folderBookmarkBusyId === folder.id}
                                  onToggleBookmark={handleToggleFolderBookmark}
                                  onOpenProfile={openProfile}
                                  onOpenActions={openCardActions}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}

                    {/* PDFs */}
                    {communityType !== "folders" && (
                      <>
                        <div className="mc-section-label">PDF DOCUMENTS</div>
                        {resourcesLoading ? (
                          <LoadingState grid count={4} />
                        ) : resourcesError ? (
                          <ErrorState message={resourcesError} onRetry={fetchResources} />
                        ) : visiblePdfs.length === 0 ? (
                          <EmptyState
                            icon={communityEmptyStates.pdf.icon}
                            title={communityEmptyStates.pdf.title}
                            message={communityEmptyStates.pdf.message}
                          />
                        ) : (
                          <div className="mc-pdfs-grid">
                            {visiblePdfs.map((resource) => (
                              <PdfCard
                                key={resource.id}
                                resource={resource}
                                isBookmarked={bookmarkedIds.has(resource.id)}
                                bookmarkBusy={bookmarkBusyId === resource.id}
                                onOpen={(r) => handleOpen(r.shareToken)}
                                onToggleBookmark={toggleBookmark}
                                onOpenActions={openCardActions}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
          </div>
        </div>
      )}

      {toast && (
        <div className="mc-toast show">
          <McIcon name={toast.icon || "check"} />
          <span>{toast.msg}</span>
          {toast.actLabel && (
            <button className="mc-toast-act" onClick={runToastAction}>{toast.actLabel}</button>
          )}
        </div>
      )}

      {showFab && activeTab === "library" && (
        <div onClick={() => setShowFab(false)} className="mc-fab-overlay fixed inset-0 z-[998] bg-black/50" style={{ animation: "fade-up 0.15s ease" }} />
      )}

      <div className="mc-fab-container fixed bottom-24 right-6 z-[999] flex flex-col items-end gap-3">
        {showFab && activeTab === "library" && (
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
        {activeTab === "library" && (
          <button
            onClick={() => setShowFab((v) => !v)}
            className={`mc-fab${showFab ? " open" : ""}`}
            title="Quick actions"
          >
            <span className="mc-fab-plus"><McIcon name="plus" /></span>
            <span>New</span>
          </button>
        )}
      </div>

      {/* My Circle sheets */}
      <CardActionSheet
        open={!!actionTarget && !showReport}
        onClose={() => setActionTarget(null)}
        target={actionTarget}
        onShare={handleActionShare}
        onCopyLink={handleActionCopyLink}
        onReport={handleActionReport}
      />
      <ReportSheet
        open={showReport}
        onClose={() => { setShowReport(false); setActionTarget(null); }}
        target={actionTarget}
        onSubmit={handleReportSubmit}
      />
      <ProfileSheet
        open={!!profileOwner}
        onClose={() => setProfileOwner(null)}
        owner={profileOwner}
        folders={profileFolders}
        onOpenFolder={openFolder}
      />
      <RecycleBinSheet
        open={recycleBinOpen}
        onClose={() => setRecycleBinOpen(false)}
        items={recycleItems}
        onRestore={handleRestoreTrash}
        onPurge={handlePurgeTrash}
        busyId={recycleBinBusyId}
      />
      <CircleSheet open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={deleteTarget?.name} kind="Space">
        <p className="mc-sheet-hint">
          This space and its items will be moved to the Recycle Bin. You can restore it any time within <b>30 days</b>.
        </p>
        <button className="mc-act-row danger" onClick={confirmSpaceDelete}>
          <McIcon name="trash" />
          <div>
            <div className="mc-r-t">Move to Recycle Bin</div>
            <div className="mc-r-s">Restorable for 30 days, then removed forever</div>
          </div>
        </button>
        <button className="mc-act-row" onClick={() => setDeleteTarget(null)}>
          <McIcon name="x" />
          <div><div className="mc-r-t">Cancel</div></div>
        </button>
      </CircleSheet>

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

import { API_BASE } from "../../lib/constants";