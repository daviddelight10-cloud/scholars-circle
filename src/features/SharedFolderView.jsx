import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFolderByShareToken, bookmarkFolder, unbookmarkFolder } from "../lib/foldersApi";
import { formatViewCount } from "../lib/researchUtils";
import { formatRelativeDate } from "./research-hub/constants.js";
import { createLiveRoom } from "./live-quiz/liveQuizApi.js";
import ResourceViewer from "./ResourceViewer";
import PracticeSheet from "./research-hub/PracticeSheet.jsx";
import ShareSheet from "./research-hub/ShareSheet.jsx";
import EmptyState from "./research-hub/EmptyState.jsx";
import { IC } from "./research-hub/spaceRowIcons.jsx";
import { ProgressRing } from "./research-hub/spaceRowUi.jsx";
import "../research-hub.css";

function getAuth() {
  try {
    return JSON.parse(localStorage.getItem("scholars-circle-auth") || "{}");
  } catch {
    return {};
  }
}

const FILE_TYPES = ["pdf", "docx", "pptx", "txt", "image", "doc", "note", "tutorial_question"];

/**
 * Shared folder landing view (/folders/:shareToken) — public link target.
 * Mirrors My Space's FolderDetailView: hero + list-first file rows, and
 * tapping a file opens the same practice sheet. Owner-only actions
 * (generate / guided study / exam build) funnel guests to login and
 * logged-in recipients to "Save to my space".
 */
export default function SharedFolderView() {
  const { shareToken } = useParams();
  const navigate = useNavigate();
  const [folder, setFolder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerToken, setViewerToken] = useState(null);
  const [isAuthenticated] = useState(() => !!getAuth().authToken);
  const [folderBookmarked, setFolderBookmarked] = useState(false);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [sheetFile, setSheetFile] = useState(null);
  const [fileSearch, setFileSearch] = useState("");
  const [goingLive, setGoingLive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let alive = true;
    getFolderByShareToken(shareToken)
      .then((data) => {
        if (!alive) return;
        setFolder(data);
        setFolderBookmarked(!!data.folderBookmarked);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || "Failed to load folder");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [shareToken]);

  const toastTimer = useRef(null);
  const say = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const loginRedirect = useCallback(() => {
    navigate("/login?redirect=" + encodeURIComponent(`/folders/${shareToken}`));
  }, [navigate, shareToken]);

  const handleToggleFolderBookmark = useCallback(async () => {
    if (!folder) return;
    if (!isAuthenticated) { loginRedirect(); return; }
    setBookmarkBusy(true);
    try {
      if (folderBookmarked) {
        await unbookmarkFolder(folder.id);
        setFolderBookmarked(false);
        say("Removed from your space");
      } else {
        const result = await bookmarkFolder(folder.id);
        setFolderBookmarked(true);
        const count = result?.resourcesBookmarked;
        say(count > 0 ? `Space + ${count} materials saved ✓` : "Space saved to your library ✓");
      }
    } catch {
      say("Couldn't update — try again");
    } finally {
      setBookmarkBusy(false);
    }
  }, [folder, folderBookmarked, isAuthenticated, loginRedirect, say]);

  // Group flat resources into source files with nested study variants —
  // same shape FolderDetailView feeds the practice sheet.
  const categorized = useMemo(() => {
    const resources = folder?.resources || [];
    const derivedBySource = {};
    for (const r of resources) {
      if (r.sourceResourceId) (derivedBySource[r.sourceResourceId] ||= []).push(r);
    }
    const sourceFiles = [];
    const standaloneItems = [];
    for (const r of resources) {
      if (r.sourceResourceId || r.contentType === "flashcard_deck") continue;
      const derived = derivedBySource[r.id] || [];
      const variants = { summary: null, mcq: null, exam: null };
      for (const d of derived) {
        if (d.contentType === "mcq") variants.mcq = d;
        else if (d.contentType === "exam") variants.exam = d;
        else if (d.contentType === "pdf" && d.fileName?.startsWith("[AI] Summary")) variants.summary = d;
        else if (d.contentType === "note" && d.title?.startsWith("[AI] Summary")) variants.summary = d;
        else if (d.contentType === "pdf" && d.description && d.title === r.title) variants.summary = d;
      }
      if (FILE_TYPES.includes(r.contentType)) {
        sourceFiles.push({ ...r, variants, standalone: false });
      } else if (r.contentType === "mcq") {
        standaloneItems.push({ ...r, variants: { mcq: r, summary: null, exam: null }, standalone: true });
      } else if (r.contentType === "exam") {
        standaloneItems.push({ ...r, variants: { mcq: null, summary: null, exam: r }, standalone: true });
      } else if ((r.contentType === "pdf" || r.contentType === "note") && r.title?.startsWith("[AI] Summary")) {
        standaloneItems.push({ ...r, variants: { mcq: null, summary: r, exam: null }, standalone: true });
      }
    }
    return { materials: sourceFiles, standaloneItems };
  }, [folder]);

  const allFiles = useMemo(() => {
    const docs = [...categorized.materials];
    const seen = new Set(docs.map((d) => d.id));
    for (const f of categorized.standaloneItems) {
      if (f.title?.startsWith("[AI]")) continue; // auto-saved study outputs stay out of Files
      if (!seen.has(f.id)) { docs.push(f); seen.add(f.id); }
    }
    return docs;
  }, [categorized]);

  const files = useMemo(() => {
    const q = fileSearch.trim().toLowerCase();
    if (!q) return allFiles;
    return allFiles.filter((f) =>
      (f.title || "").toLowerCase().includes(q) ||
      (f.fileName || "").toLowerCase().includes(q) ||
      (f.subject || "").toLowerCase().includes(q) ||
      (f.courseCode || "").toLowerCase().includes(q)
    );
  }, [allFiles, fileSearch]);

  // Owner-only practice actions — guests log in, members save the space first.
  const studyGate = useCallback(() => {
    if (!isAuthenticated) { loginRedirect(); return; }
    if (!folderBookmarked) {
      handleToggleFolderBookmark();
      say("Space saved — study tools live in My Space");
    } else {
      say("Open this space in My Space to use study tools");
    }
  }, [isAuthenticated, folderBookmarked, loginRedirect, handleToggleFolderBookmark, say]);

  const handleGoLive = useCallback(async (file) => {
    if (!isAuthenticated) { loginRedirect(); return; }
    const mcq = file?.variants?.mcq;
    if (!mcq || goingLive) return;
    setGoingLive(true);
    say("Creating live session…");
    try {
      const [res] = await Promise.all([
        createLiveRoom(mcq.id),
        import("./live-quiz/LiveQuizPage"),
      ]);
      navigate(`/live/${res.code}`, { state: { ticket: res.ticket, roomId: res.roomId } });
    } catch (e) {
      say(e.message || "Couldn't start live session");
    } finally {
      setGoingLive(false);
    }
  }, [isAuthenticated, goingLive, loginRedirect, navigate, say]);

  const shareTarget = useMemo(() => folder && ({
    type: "folder",
    id: folder.id,
    shareToken: folder.shareToken || shareToken,
    title: folder.name,
    meta: [folder.courseCode, folder.level, folder.semester].filter(Boolean).join(" · "),
    visibility: folder.visibility,
  }), [folder, shareToken]);

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} onBack={() => setViewerToken(null)} />;
  }

  if (loading) {
    return (
      <div className="mc-root" style={{ minHeight: "100dvh", background: "#0a0a0a" }}>
        <div style={{ padding: "80px 20px", textAlign: "center", color: "#9AA3B5", fontSize: 14 }}>
          Loading shared space…
        </div>
      </div>
    );
  }

  if (error || !folder) {
    return (
      <div className="mc-root" style={{ minHeight: "100dvh", background: "#0a0a0a" }}>
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#EDEFF5", marginBottom: 6 }}>Space not accessible</div>
          <div style={{ fontSize: 13, color: "#646E84", marginBottom: 18 }}>{error || "This link may have expired."}</div>
          <button
            onClick={() => navigate(isAuthenticated ? "/resources" : "/")}
            style={{ padding: "10px 22px", background: "rgba(255,179,0,0.12)", border: "1px solid rgba(255,179,0,0.35)", borderRadius: "10px", fontSize: 13, fontWeight: 800, color: "#FFB300", cursor: "pointer" }}
          >
            {isAuthenticated ? "Go to My Space" : "Back home"}
          </button>
        </div>
      </div>
    );
  }

  const ownerName = folder.owner?.username || folder.owner?.lecturerProfile?.fullName || "a scholar";
  const metaLine = [folder.courseCode, folder.level, folder.semester].filter(Boolean).join(" · ");

  return (
    <div className="mc-root" style={{ minHeight: "100dvh", background: "#0a0a0a" }}>
      <div className="mx-auto w-full max-w-[1400px]" style={{ paddingBottom: "96px" }}>

        {/* Header */}
        <div className="sp-header px-5 md:px-8 lg:px-12">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate(isAuthenticated ? "/resources" : "/")}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full border text-[#9AA3B5] transition-colors"
              style={{ background: "#1a1a1c", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#646E84]">Shared Space</div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-[#EDEFF5]">
                {metaLine || folder.name}
              </div>
            </div>
            <button
              onClick={() => setShareOpen(true)}
              aria-label="Share this space"
              className="flex h-9 w-9 items-center justify-center rounded-full border text-[#9AA3B5] transition-colors"
              style={{ background: "#1a1a1c", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M16 6l-4-4-4 4" /><path d="M12 2v14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="px-5 md:px-8 lg:px-12">
          <div className="sp-hero">
            <div className="sp-hero-glow-a" />
            <div className="sp-hero-glow-b" />
            <div className="relative">
              <div className="mb-3 flex items-center gap-2">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: "#F5A623" }} />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#F5A623" }}>Shared Space</span>
              </div>
              <h2 className="sp-hero-title">{folder.courseCode || folder.name}</h2>
              <p className="sp-hero-sub">
                {folder.courseCode && folder.name !== folder.courseCode ? `${folder.name} · ` : ""}
                Shared by {ownerName}{folder.university?.name ? ` · ${folder.university.name}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 relative">
                <button
                  onClick={folderBookmarked ? () => navigate("/resources") : handleToggleFolderBookmark}
                  disabled={bookmarkBusy}
                  className="rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all active:scale-95"
                  style={{
                    background: folderBookmarked ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#d98f0f,#F5A623)",
                    color: folderBookmarked ? "#EDEFF5" : "#0a0a0a",
                    border: folderBookmarked ? "1px solid rgba(255,255,255,0.12)" : "none",
                    cursor: bookmarkBusy ? "wait" : "pointer",
                    opacity: bookmarkBusy ? 0.6 : 1,
                  }}
                >
                  {bookmarkBusy ? "Saving…" : folderBookmarked ? "✓ Saved — open My Space" : isAuthenticated ? "☆ Save to my space" : "🔑 Log in to save"}
                </button>
              </div>
            </div>
            <div className="sp-hero-stats relative">
              <div>
                <div className="sp-hero-stat-num">{allFiles.length}</div>
                <div className="sp-hero-stat-label">Files</div>
              </div>
              <div className="sp-hero-divider" />
              <div>
                <div className="sp-hero-stat-num">
                  {allFiles.filter((f) => f.variants?.mcq).length}
                </div>
                <div className="sp-hero-stat-label">Quiz sets</div>
              </div>
              <div className="sp-hero-divider" />
              <div>
                <div className="sp-hero-stat-num">
                  {allFiles.filter((f) => f.variants?.summary).length}
                </div>
                <div className="sp-hero-stat-label">Summaries</div>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mt-4 flex items-center gap-2 px-5 md:px-8 lg:px-12">
          <div className="sp-search">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#646E84" strokeWidth="2.4" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={fileSearch}
              onChange={(e) => setFileSearch(e.target.value)}
              placeholder="Search files…"
              aria-label="Search files in this space"
            />
          </div>
        </div>

        {/* Files list — tap a row to open the practice sheet */}
        <div className="mt-4 grid grid-cols-1 gap-2 px-5 md:grid-cols-2 md:px-8 lg:px-12 xl:grid-cols-3">
          {files.length > 0 ? (
            files.map((file, i) => {
              const tools = [
                file.variants?.mcq ? IC.pencil : null,
                file.variants?.summary ? IC.notes : null,
              ].filter(Boolean);
              return (
                <div
                  key={file.id}
                  className="sp-row sp-fade-up"
                  style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${file.title}`}
                  onClick={() => setSheetFile(file)}
                  onKeyDown={(e) => {
                    if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                      e.preventDefault();
                      setSheetFile(file);
                    }
                  }}
                >
                  <ProgressRing pct={0} />
                  <div className="sp-row-body">
                    <div className="sp-row-title-row">
                      <p className="sp-row-title">{file.title}</p>
                    </div>
                    <div className="sp-row-meta">
                      {(file.subject || file.courseCode) && (
                        <>
                          <span className="sub">{file.subject || file.courseCode}</span><span>·</span>
                        </>
                      )}
                      <span>{formatRelativeDate(file.createdAt)}</span>
                      <span>·</span>
                      {IC.eye}
                      <span>{formatViewCount(file.viewCount || 0)}</span>
                      <span className="grow" />
                      {tools.length > 0 && <span className="sp-row-tools">{tools.map((t, ti) => <span key={ti}>{t}</span>)}</span>}
                    </div>
                  </div>
                  <span style={{ color: "#646E84", flexShrink: 0, display: "flex" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </span>
                </div>
              );
            })
          ) : fileSearch ? (
            <div className="col-span-full">
              <EmptyState icon="🔍" title={`No files match "${fileSearch}"`} message="Try a different search term." />
            </div>
          ) : (
            <div className="col-span-full">
              <EmptyState icon="📄" title="This space is empty" message="The owner hasn't added any materials yet." />
            </div>
          )}
        </div>
      </div>

      {/* Practice sheet — same one My Space uses */}
      <PracticeSheet
        file={sheetFile}
        onClose={() => setSheetFile(null)}
        onOpen={(t) => setViewerToken(t)}
        onGenerate={studyGate}
        onGuidedStudy={studyGate}
        onExamSimulation={studyGate}
        onGoLive={handleGoLive}
        goingLive={goingLive}
        onJoinLive={(code) => (isAuthenticated ? navigate(`/live/${code}`) : loginRedirect())}
      />

      {/* Re-share */}
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        target={shareTarget}
        notify={say}
        onRequireAuth={loginRedirect}
      />

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-[1002] flex -translate-x-1/2 items-center gap-2.5 rounded-full border px-4 py-2.5 text-[13px] font-semibold shadow-lg"
          style={{ background: "#141414", borderColor: "rgba(245,166,35,0.35)", color: "#F5A623", animation: "fade-up 0.2s ease both", maxWidth: "calc(100vw - 32px)" }}
          role="status"
        >
          <span className="truncate">{toast}</span>
        </div>
      )}
    </div>
  );
}
