import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { getResourceByShareToken, unbookmarkResource } from "../lib/resourcesApi";
import { formatViewCount } from "../lib/researchUtils";
import { formatRelativeDate } from "./research-hub/constants.js";
import { createLiveRoom } from "./live-quiz/liveQuizApi.js";
import ResourceViewer from "./ResourceViewer";
import PracticeSheet from "./research-hub/PracticeSheet.jsx";
import ShareSheet from "./research-hub/ShareSheet.jsx";
import SaveToSpaceSheet from "./research-hub/SaveToSpaceSheet.jsx";
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

const questionCount = (v) => {
  if (!v) return 0;
  if (v.questionCount != null) return v.questionCount;
  try {
    const raw = v.mcqData ?? v.flashcardData;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(data)) return data.length;
    if (Array.isArray(data?.questions)) return data.questions.length;
  } catch {}
  return 0;
};

const buildVariants = (file, derived) => {
  const variants = { summary: null, mcq: null, exam: null };
  for (const d of derived || []) {
    if (d.contentType === "mcq") variants.mcq = d;
    else if (d.contentType === "exam") variants.exam = d;
    else if (d.contentType === "pdf" && d.fileName?.startsWith("[AI] Summary")) variants.summary = d;
    else if (d.contentType === "note" && d.title?.startsWith("[AI] Summary")) variants.summary = d;
    else if (d.contentType === "pdf" && d.description && d.title === file.title) variants.summary = d;
  }
  return variants;
};

const isAiSummaryItem = (r) =>
  (r?.contentType === "pdf" || r?.contentType === "note") &&
  (r?.fileName?.startsWith("[AI] Summary") || r?.title?.startsWith("[AI] Summary"));

/**
 * Shared material landing view (/resources/:token) — public link target.
 * Mirrors SharedFolderView: hero + a single file row that opens the same
 * practice sheet, with a "Save to my space" CTA. The viewer itself stays
 * ResourceViewer, rendered inline like the folder view does.
 */
export default function SharedResourceView() {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [resource, setResource] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewerToken, setViewerToken] = useState(null);
  const [auth] = useState(getAuth);
  const isAuthenticated = !!auth.authToken;
  const [bookmarked, setBookmarked] = useState(false);
  const [savedFolderId, setSavedFolderId] = useState(null);
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [saveSheetOpen, setSaveSheetOpen] = useState(false);
  const [savePurpose, setSavePurpose] = useState("save"); // "save" | "study" — drives the toast
  const [descExpanded, setDescExpanded] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let alive = true;
    getResourceByShareToken(token)
      .then((data) => {
        if (!alive) return;
        setResource(data);
        setBookmarked(!!data.bookmarked);
        setSavedFolderId(data.bookmarkFolderId || null);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message || "Failed to load material");
        setLoading(false);
      });
    return () => { alive = false; };
  }, [token]);

  const toastTimer = useRef(null);
  const say = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const loginRedirect = useCallback(() => {
    navigate("/login?redirect=" + encodeURIComponent(`/resources/${token}`));
  }, [navigate, token]);

  // In-app navigations leave a history entry we can pop back to; a link
  // opened fresh (new tab, external app) has key "default" — then the exit
  // is /app for members and the landing page for guests, never the bare
  // /resources route that strands users outside the shell.
  const goBack = useCallback(() => {
    if (location.key !== "default") navigate(-1);
    else navigate(isAuthenticated ? "/app" : "/");
  }, [location.key, navigate, isAuthenticated]);

  // Deep-link into the app's research-hub tab — with the space open when we
  // know it — instead of the standalone /resources mount of ResearchHub.
  const openMySpace = useCallback((folderId) => {
    const detail = { tab: "space", ...(folderId ? { folderId } : {}) };
    window.__sc_pending_hub_tab = detail;
    window.dispatchEvent(new CustomEvent("sc-open-research-hub", { detail }));
    navigate("/app");
  }, [navigate]);

  const isOwner = !!auth.authUser?.id && String(resource?.uploadedBy) === String(auth.authUser.id);

  // Normalize into the file+variants shape the practice sheet expects.
  // The shared item can be a source file, a derived variant (quiz/summary
  // shared directly → show its parent), or a standalone item.
  const file = useMemo(() => {
    if (!resource) return null;
    const parent = resource.sourceResource;
    if (resource.sourceResourceId && parent && parent.linkShared !== false) {
      return { ...parent, variants: buildVariants(parent, parent.derivedResources) };
    }
    const variants = buildVariants(resource, resource.derivedResources);
    if (!variants.mcq && resource.contentType === "mcq") variants.mcq = resource;
    if (!variants.exam && resource.contentType === "exam") variants.exam = resource;
    if (!variants.summary && isAiSummaryItem(resource)) variants.summary = resource;
    return { ...resource, variants };
  }, [resource]);

  // The bookmarkable id — saving a shared variant should save its source
  // material so the cascade picks up every study tool under it.
  const saveTargetId = file?.id || resource?.id;

  const handleToggleBookmark = useCallback(async () => {
    if (!resource || !saveTargetId) return;
    if (!isAuthenticated) { loginRedirect(); return; }
    if (!bookmarked) {
      // No loose saves — picking a space is required, same as My Space.
      setSavePurpose("save");
      setSaveSheetOpen(true);
      return;
    }
    setBookmarkBusy(true);
    try {
      await unbookmarkResource(saveTargetId);
      setBookmarked(false);
      say("Removed from your space");
    } catch {
      say("Couldn't update — try again");
    } finally {
      setBookmarkBusy(false);
    }
  }, [resource, saveTargetId, bookmarked, isAuthenticated, loginRedirect, say]);

  // After SaveToSpaceSheet bookmarks into the chosen space.
  const handleSaved = useCallback((result, folderId, folderName) => {
    setBookmarked(true);
    setSavedFolderId(folderId || null);
    const extra = (result?.bookmarkedIds?.length || 1) - 1;
    const into = folderName ? ` to "${folderName}"` : "";
    if (savePurpose === "study") {
      say(`Saved${into} — study tools live in My Space`);
    } else {
      say(extra > 0
        ? `Material + ${extra} study tool${extra > 1 ? "s" : ""} saved${into} ✓`
        : `Saved${into} ✓`);
    }
  }, [say, savePurpose]);

  // Owner-only practice actions — guests log in, members save into a space first.
  const studyGate = useCallback(() => {
    if (!isAuthenticated) { loginRedirect(); return; }
    if (!bookmarked && !isOwner) {
      setSavePurpose("study");
      setSaveSheetOpen(true);
    } else {
      say("Open this material in My Space to use study tools");
    }
  }, [isAuthenticated, bookmarked, isOwner, loginRedirect, say]);

  const handleGoLive = useCallback(async (f) => {
    if (!isAuthenticated) { loginRedirect(); return; }
    const mcq = f?.variants?.mcq;
    if (!mcq || goingLive) return;
    setGoingLive(true);
    say("Creating live session…");
    try {
      const [res] = await Promise.all([
        createLiveRoom(mcq.id),
        import("./live-quiz/LiveQuizPage"),
      ]);
      navigate(`/live/${res.code}`, { state: { ticket: res.ticket, roomId: res.roomId, returnTo: `/resources/${token}` } });
    } catch (e) {
      say(e.message || "Couldn't start live session");
    } finally {
      setGoingLive(false);
    }
  }, [isAuthenticated, goingLive, loginRedirect, navigate, say, token]);

  const shareTarget = useMemo(() => resource && ({
    type: "resource",
    id: resource.id,
    shareToken: resource.shareToken || token,
    title: file?.title || resource.title,
    meta: [resource.subject, resource.courseCode].filter(Boolean).join(" · "),
    contentType: resource.contentType,
    linkShared: resource.linkShared,
    isOwner,
  }), [resource, file, token, isOwner]);

  if (viewerToken) {
    return <ResourceViewer token={viewerToken} onBack={() => setViewerToken(null)} />;
  }

  if (loading) {
    return (
      <div className="mc-root" style={{ minHeight: "100dvh", background: "#0a0a0a" }}>
        <div style={{ padding: "80px 20px", textAlign: "center", color: "#9AA3B5", fontSize: 14 }}>
          Loading shared material…
        </div>
      </div>
    );
  }

  if (error || !resource || !file) {
    return (
      <div className="mc-root" style={{ minHeight: "100dvh", background: "#0a0a0a" }}>
        <div style={{ padding: "80px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#EDEFF5", marginBottom: 6 }}>Material not accessible</div>
          <div style={{ fontSize: 13, color: "#646E84", marginBottom: 18 }}>{error || "The owner may have turned off link sharing, or this link expired."}</div>
          <button
            onClick={goBack}
            style={{ padding: "10px 22px", background: "rgba(255,179,0,0.12)", border: "1px solid rgba(255,179,0,0.35)", borderRadius: "10px", fontSize: 13, fontWeight: 800, color: "#FFB300", cursor: "pointer" }}
          >
            {isAuthenticated ? "Go to My Space" : "Back home"}
          </button>
        </div>
      </div>
    );
  }

  const ownerName = resource.uploader?.username || "a scholar";
  const metaLine = [resource.subject, resource.courseCode].filter(Boolean).join(" · ");
  const mcqQCount = questionCount(file.variants?.mcq);
  const hasSummary = !!file.variants?.summary;
  const tools = [file.variants?.mcq ? IC.pencil : null, hasSummary ? IC.notes : null].filter(Boolean);

  return (
    <div className="mc-root" style={{ minHeight: "100dvh", background: "#0a0a0a" }}>
      <div className="mx-auto w-full max-w-[1400px]" style={{ paddingBottom: "96px" }}>

        {/* Header */}
        <div className="sp-header px-5 md:px-8 lg:px-12">
          <div className="flex items-center justify-between">
            <button
              onClick={goBack}
              aria-label="Back"
              className="flex h-9 w-9 items-center justify-center rounded-full border text-[#9AA3B5] transition-colors"
              style={{ background: "#1a1a1c", borderColor: "rgba(255,255,255,0.07)" }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0 flex-1 text-center">
              <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#646E84]">Shared Material</div>
              <div className="mt-0.5 truncate text-[13px] font-semibold text-[#EDEFF5]">
                {metaLine || file.title}
              </div>
            </div>
            <button
              onClick={() => setShareOpen(true)}
              aria-label="Share this material"
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
                <span className="text-[9px] font-bold uppercase tracking-[0.2em]" style={{ color: "#F5A623" }}>Shared Material</span>
              </div>
              <h2 className="sp-hero-title">{file.title}</h2>
              <p className="sp-hero-sub">
                Shared by {ownerName}{resource.university?.name ? ` · ${resource.university.name}` : ""}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 relative">
                {isOwner ? (
                  <button
                    onClick={() => openMySpace(resource.folderId)}
                    className="rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all active:scale-95"
                    style={{ background: "rgba(255,255,255,0.07)", color: "#EDEFF5", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}
                  >
                    Open in My Space
                  </button>
                ) : (
                  <button
                    onClick={bookmarked ? () => openMySpace(savedFolderId) : handleToggleBookmark}
                    disabled={bookmarkBusy}
                    className="rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all active:scale-95"
                    style={{
                      background: bookmarked ? "rgba(255,255,255,0.07)" : "linear-gradient(135deg,#d98f0f,#F5A623)",
                      color: bookmarked ? "#EDEFF5" : "#0a0a0a",
                      border: bookmarked ? "1px solid rgba(255,255,255,0.12)" : "none",
                      cursor: bookmarkBusy ? "wait" : "pointer",
                      opacity: bookmarkBusy ? 0.6 : 1,
                    }}
                  >
                    {bookmarkBusy ? "Saving…" : bookmarked ? "✓ Saved — open My Space" : isAuthenticated ? "☆ Save to my space" : "🔑 Log in to save"}
                  </button>
                )}
                <button
                  onClick={() => setSheetOpen(true)}
                  className="rounded-xl px-5 py-2.5 text-[13px] font-bold transition-all active:scale-95"
                  style={{ background: "rgba(255,255,255,0.07)", color: "#EDEFF5", border: "1px solid rgba(255,255,255,0.12)", cursor: "pointer" }}
                >
                  ⚡ Practice
                </button>
              </div>
            </div>
            <div className="sp-hero-stats relative">
              <div>
                <div className="sp-hero-stat-num">{formatViewCount(resource.viewCount || 0)}</div>
                <div className="sp-hero-stat-label">Views</div>
              </div>
              <div className="sp-hero-divider" />
              <div>
                <div className="sp-hero-stat-num">{mcqQCount || "—"}</div>
                <div className="sp-hero-stat-label">Questions</div>
              </div>
              <div className="sp-hero-divider" />
              <div>
                <div className="sp-hero-stat-num">{hasSummary ? "✓" : "—"}</div>
                <div className="sp-hero-stat-label">Summary</div>
              </div>
            </div>
          </div>
        </div>

        {/* The material — tap to open the practice sheet */}
        <div className="mt-4 grid grid-cols-1 gap-2 px-5 md:grid-cols-2 md:px-8 lg:px-12 xl:grid-cols-3">
          <div
            className="sp-row sp-fade-up"
            role="button"
            tabIndex={0}
            aria-label={`Open ${file.title}`}
            onClick={() => setSheetOpen(true)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
                e.preventDefault();
                setSheetOpen(true);
              }
            }}
          >
            <ProgressRing pct={0} />
            <div className="sp-row-body">
              <div className="sp-row-title-row">
                <p className="sp-row-title">{file.title}</p>
              </div>
              <div className="sp-row-meta">
                {metaLine && <><span className="sub">{metaLine}</span><span>·</span></>}
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
          {resource.description && (
            <div className="col-span-full mt-1 px-1" style={{ color: "#9AA3B5", fontSize: 13, lineHeight: 1.6 }}>
              <div
                style={descExpanded
                  ? { whiteSpace: "pre-wrap" }
                  : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-wrap" }}
              >
                {resource.description}
              </div>
              {resource.description.length > 180 && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  style={{ background: "none", border: "none", color: "#F5A623", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "4px 0" }}
                >
                  {descExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-5 md:px-8 lg:px-12 mt-6">
          <EmptyState
            icon="💡"
            title="Tap the card to practice"
            message="Rapid recall, guided study, summaries and live quizzes open from the practice menu."
          />
        </div>

        {/* Report / legal — the copyright form is public, no account needed */}
        <div className="px-5 md:px-8 lg:px-12 mt-8" style={{ textAlign: "center" }}>
          <button
            onClick={() => navigate(`/copyright?u=${encodeURIComponent(window.location.href)}`)}
            style={{ background: "none", border: "none", color: "#4a5080", fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
          >
            ⚑ Report this content
          </button>
        </div>
      </div>

      {/* Practice sheet — same one My Space uses */}
      <PracticeSheet
        file={sheetOpen ? file : null}
        onClose={() => setSheetOpen(false)}
        onOpen={(t) => setViewerToken(t)}
        onGenerate={studyGate}
        onGuidedStudy={studyGate}
        onExamSimulation={studyGate}
        onGoLive={handleGoLive}
        goingLive={goingLive}
        onJoinLive={(code) => (isAuthenticated ? navigate(`/live/${code}`, { state: { returnTo: `/resources/${token}` } }) : loginRedirect())}
      />

      {/* Save — pick a space (or create one) before the material lands */}
      <SaveToSpaceSheet
        open={saveSheetOpen}
        resource={file ? { id: saveTargetId, title: file.title, subject: resource.subject } : null}
        onClose={() => setSaveSheetOpen(false)}
        onSaved={handleSaved}
        notify={say}
      />

      {/* Re-share */}
      <ShareSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        target={shareTarget}
        notify={say}
        onRequireAuth={loginRedirect}
        onOpenDestination={(dest) => {
          window.__sc_pending_feed_tab = dest === "chats" ? "chats" : "feed";
          window.dispatchEvent(new CustomEvent("sc-open-feed"));
          navigate("/app");
        }}
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
