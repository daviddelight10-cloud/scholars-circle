import { memo, useState } from "react";
import { getSubjectColor } from "./subjectColors";
import { getContentTypeIcon, formatViewCount } from "../../lib/researchUtils";

function formatRelativeDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWk = Math.floor(diffDay / 7);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWk < 4) return `${diffWk}w ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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

const TYPE_CONFIG = {
  pdf: { label: "PDF", icon: "📄" },
  image: { label: "Image", icon: "🖼" },
  docx: { label: "DOCX", icon: "📝" },
  pptx: { label: "PPT", icon: "📊" },
  txt: { label: "Text", icon: "📃" },
  note: { label: "Note", icon: "📝" },
  mcq: { label: "MCQ", icon: "✎" },
  flashcard_deck: { label: "Flashcards", icon: "🎴" },
  tutorial_question: { label: "Tutorial Q", icon: "❓" },
};

const ResourceCard = memo(function ResourceCard({ resource, isBookmarked, bookmarkBusy, onOpen, onToggleBookmark, onShare, mcqProgress, index = 0 }) {
  const [hovered, setHovered] = useState(false);
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
  const typeConfig = TYPE_CONFIG[resource.contentType] || TYPE_CONFIG.note;
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
        <button onClick={() => onOpen(resource.shareToken)} className="flex-1 rounded-lg border border-gold-border bg-gold-dim px-2 py-1.5 text-[10px] font-semibold text-gold transition-all active:scale-95">
          Open
        </button>
        <button
          onClick={() => onToggleBookmark(resource)}
          disabled={bookmarkBusy}
          title={isBookmarked ? "Remove from your space" : "Add to your space"}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-hub-border bg-hub-bg text-sm transition-all active:scale-90"
          style={{ color: isBookmarked ? "#f5a623" : "#5a6090" }}
        >
          {isBookmarked ? "★" : "☆"}
        </button>
        <button onClick={() => onShare(resource.shareToken)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-hub-border bg-hub-bg text-sm transition-all active:scale-90">
          🔗
        </button>
      </div>
    </div>
  );
});

export default ResourceCard;
