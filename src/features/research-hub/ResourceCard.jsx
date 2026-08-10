import { memo, useState } from "react";
import { getSubjectColor } from "./subjectColors";
import { getContentTypeIcon, formatViewCount } from "../../lib/researchUtils";
import { contentTypeConfig, formatRelativeDate } from "./constants";

function McqProgressRing({ practiced, pct, progress }) {
  const size = 28;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? "#4caf50" : pct >= 50 ? "#ffb74d" : pct > 0 ? "#ef4444" : "#555";

  if (!practiced) {
    return (
      <div title="Not attempted yet" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-hub-border text-[9px] text-hub-text-dim">
        —
      </div>
    );
  }

  return (
    <div title={`Best: ${progress.bestScore}/${progress.total} (${pct}%) · ${progress.attempts} attempt${progress.attempts > 1 ? "s" : ""}`} className="relative h-7 w-7 shrink-0">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#2a2a2a" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color }}>{pct}%</div>
    </div>
  );
}

const GENERATABLE_TYPES = ["pdf", "docx", "pptx", "txt", "image", "doc", "note"];

const FAB_ACTIONS = [
  { id: "mcqs", icon: "✎", label: "Generate MCQs + Flashcards" },
  { id: "flashcards", icon: "🎴", label: "Generate Flashcards + MCQs" },
  { id: "summary", icon: "📝", label: "Summarize" },
  { id: "voice", icon: "🎙️", label: "Study with Voice Tutor" },
];

const ResourceCard = memo(function ResourceCard({ resource, isBookmarked, bookmarkBusy, onOpen, onToggleBookmark, onShare, mcqProgress, index = 0, onGenerate, onStudyWithVoice, generatingId, genProgress, genErrorId, genError, onRetry, onDismissGenError, showBookmark = true, relevanceTier = null }) {
  const [hovered, setHovered] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const isGeneratable = GENERATABLE_TYPES.includes(resource.contentType);
  const isGenerating = generatingId === resource.id;
  const hasGenError = genErrorId === resource.id && !!genError;
  const sc = getSubjectColor(resource.subject);
  const icon = getContentTypeIcon(resource.contentType);
  const isPending = resource.status === "pending";
  const isPremium = resource.isPremium;
  const saveCount = resource._count?.bookmarks ?? 0;
  const rating = resource.avgRating ? resource.avgRating.toFixed(1) : null;
  const isMcq = resource.contentType === "mcq";
  const progress = isMcq && mcqProgress ? mcqProgress[resource.id] : null;
  const pct = progress && progress.total > 0 ? Math.round((progress.bestScore / progress.total) * 100) : 0;
  const practiced = progress != null;
  const relDate = formatRelativeDate(resource.createdAt);
  const typeConfig = contentTypeConfig[resource.contentType] || contentTypeConfig.note;
  const sourceName = resource.fileName || resource.sourcePdf || null;
  const delay = `${Math.min(index * 40, 400)}ms`;

  return (
    <div
      className="stagger-in relative cursor-pointer rounded-xl border border-hub-border bg-hub-surface p-4 transition-all duration-150 active:scale-[0.97] hover:-translate-y-0.5 hover:border-hub-border-active"
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: sc.accent,
        animationDelay: delay,
        boxShadow: hovered ? `0 4px 20px ${sc.bg}` : undefined,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="mb-2 flex items-center justify-between">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-base"
          style={{ background: sc.bg, borderColor: sc.border }}
        >
          {icon}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {isMcq && <McqProgressRing practiced={practiced} pct={pct} progress={progress} />}
          {isPending && (
            <span className="rounded bg-coral-100 px-1.5 py-0.5 text-[9px] font-bold text-coral-400 whitespace-nowrap">Pending</span>
          )}
          {isPremium && (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap" style={{ background: "rgba(245,166,35,0.14)", color: "#f5a623" }}>Premium</span>
          )}
          {relevanceTier === 1 || relevanceTier === 2 ? (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap" style={{ background: "rgba(79,142,247,0.10)", color: "#4F8EF7", border: "0.5px solid rgba(79,142,247,0.30)" }}>Your School</span>
          ) : relevanceTier === 3 ? (
            <span className="rounded px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap" style={{ background: "rgba(61,214,140,0.08)", color: "#3DD68C", border: "0.5px solid rgba(61,214,140,0.28)" }}>Your Level</span>
          ) : null}
          <span
            className="rounded px-2 py-0.5 text-[10px] font-bold"
            style={{ background: sc.bg, color: sc.text, border: `0.5px solid ${sc.border}` }}
          >
            {resource.subject}
          </span>
        </div>
      </div>

      <div className="mb-2 min-h-[36px] text-[13.5px] font-bold leading-snug text-hub-text">{resource.title}</div>

      {sourceName && (
        <div className="mb-2 truncate text-[10px] text-hub-text-dim">📎 {sourceName}</div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-hub-text-dim">
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-bold"
          style={{ background: sc.bg, color: sc.text, border: `0.5px solid ${sc.border}` }}
        >
          {typeConfig.label}
        </span>
        <span>👁 {formatViewCount(resource.viewCount)}</span>
        {rating && <span>⭐ {rating}</span>}
        {saveCount > 0 && <span>· 🔖 {saveCount}</span>}
        {relDate && <span>· {relDate}</span>}
        {resource.flagCount > 0 && <span className="text-coral-400">· ⚑ {resource.flagCount}</span>}
      </div>

      <div className="flex gap-2">
        <button onClick={() => onOpen(resource.shareToken)} className={`rounded-lg border border-gold-border bg-gold-dim px-2 py-1.5 text-[10px] font-semibold text-gold transition-all active:scale-95 ${showBookmark ? "flex-1" : "flex-1"}`}>
          Open
        </button>
        {showBookmark && (
          <button
            onClick={() => onToggleBookmark(resource)}
            disabled={bookmarkBusy}
            title={isBookmarked ? "Remove from your space" : "Add to your space"}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-hub-border bg-hub-bg text-sm transition-all active:scale-90"
            style={{ color: isBookmarked ? "#f5a623" : "#5a6090" }}
          >
            {isBookmarked ? "★" : "☆"}
          </button>
        )}
        <button onClick={() => onShare(resource.shareToken)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-hub-border bg-hub-bg text-sm transition-all active:scale-90">
          🔗
        </button>
      </div>

      {isGeneratable && (onGenerate || onStudyWithVoice) && (
        <>
          {fabOpen && (
            <div className="fixed inset-0 z-[998]" onClick={() => setFabOpen(false)} />
          )}
          {fabOpen && !isGenerating && (
            <div
              className="absolute z-[999] w-52 rounded-xl border border-gold-border bg-hub-surface p-1.5 shadow-2xl"
              style={{
                top: "28px",
                right: "-8px",
                animation: "fabslide 0.18s ease",
                boxShadow: "0 8px 32px rgba(255,215,0,0.18), 0 2px 8px rgba(0,0,0,0.4)",
              }}
            >
              {FAB_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  onClick={() => {
                    setFabOpen(false);
                    if (action.id === "voice") {
                      onStudyWithVoice?.(resource);
                    } else {
                      onGenerate?.(resource, action.id);
                    }
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[11px] font-semibold text-hub-text-muted transition-all hover:bg-gold-dim hover:text-gold active:scale-95"
                >
                  <span className="text-base">{action.icon}</span>
                  {action.label}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setFabOpen((v) => !v)}
            disabled={isGenerating}
            className="absolute flex h-9 w-9 items-center justify-center rounded-full text-lg transition-all duration-200 active:scale-90"
            style={{
              top: "-10px",
              right: "-10px",
              background: fabOpen
                ? "#1a1a1a"
                : "linear-gradient(135deg, #FFD700, #DAA520)",
              border: "2px solid rgba(255,255,255,0.15)",
              boxShadow: fabOpen
                ? "0 2px 12px rgba(0,0,0,0.5)"
                : "0 4px 16px rgba(255,215,0,0.4), 0 0 0 0 rgba(255,215,0,0.3)",
              color: fabOpen ? "#FFD700" : "#0a0a0a",
              cursor: isGenerating ? "default" : "pointer",
              animation: fabOpen || isGenerating ? "none" : "fabglow 2.5s ease-in-out infinite",
              zIndex: 10,
            }}
            title="AI tools"
          >
            {isGenerating ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <span
                style={{
                  transform: fabOpen ? "rotate(135deg)" : "rotate(0deg)",
                  display: "inline-block",
                  transition: "transform 0.25s ease",
                }}
              >
                ✦
              </span>
            )}
          </button>
        </>
      )}

      {isGenerating && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-gold-border bg-gold-dim px-3 py-2">
          <div className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <span className="truncate text-[10px] font-semibold text-gold">{genProgress || "Generating…"}</span>
        </div>
      )}

      {hasGenError && !isGenerating && (
        <div
          className="mt-2 flex items-start gap-2 rounded-lg border px-3 py-2"
          style={{
            borderColor: "rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.08)",
            animation: "error-slide-in 0.2s ease both",
          }}
        >
          <span className="shrink-0 text-sm">⚠️</span>
          <span className="flex-1 text-[10px] font-semibold text-coral-400">{genError}</span>
          <button
            onClick={() => onRetry?.()}
            className="shrink-0 rounded-md border border-coral-300 bg-coral-100/50 px-2 py-0.5 text-[9px] font-bold text-coral-400 transition-all active:scale-90 hover:bg-coral-100"
          >
            Retry
          </button>
          <button
            onClick={() => onDismissGenError?.()}
            className="shrink-0 text-[10px] text-hub-text-dim transition-colors hover:text-hub-text"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
});

export default ResourceCard;
