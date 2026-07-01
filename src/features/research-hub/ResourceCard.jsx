import { memo } from "react";
import { getSubjectBadgeColor, getContentTypeIcon, getContentTypeIconClass, formatViewCount } from "../../lib/researchUtils";
import { contentTypeConfig, colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, formatRelativeDate } from "./constants";

function McqProgressRing({ practiced, pct, progress }) {
  const size = 28;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (pct / 100) * circ;
  const color = pct >= 80 ? colors.success : pct >= 50 ? colors.warning : pct > 0 ? colors.danger : "#555";
  const ringBg = colors.border;

  if (!practiced) {
    return (
      <div title="Not attempted yet" style={{
        width: size, height: size, borderRadius: "50%", border: `${stroke}px solid ${ringBg}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "9px", color: colors.textDim, flexShrink: 0,
      }}>—</div>
    );
  }

  return (
    <div title={`Best: ${progress.bestScore}/${progress.total} (${pct}%) · ${progress.attempts} attempt${progress.attempts > 1 ? "s" : ""}`} style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={ringBg} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.4s ease" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "8px", fontWeight: fontWeight.bold, color,
      }}>{pct}%</div>
    </div>
  );
}

const ResourceCard = memo(function ResourceCard({ resource, isBookmarked, bookmarkBusy, onOpen, onToggleBookmark, onShare, mcqProgress }) {
  const badgeColor = getSubjectBadgeColor(resource.subject);
  const icon = getContentTypeIcon(resource.contentType);
  const iconClass = getContentTypeIconClass(resource.contentType);
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

  return (
    <div style={sharedStyles.card}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderActive; e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.35)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; e.currentTarget.style.boxShadow = "none"; }}>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: borderRadius.sm,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: fontSize.lg, background: typeConfig.bg, border: `0.5px solid ${typeConfig.border}`,
        }}>{icon}</div>
        <div style={{ display: "flex", gap: spacing.sm, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
          {isMcq && <McqProgressRing practiced={practiced} pct={pct} progress={progress} />}
          {isPending && <span style={sharedStyles.pendingTag}>Pending</span>}
          {isPremium && <span style={sharedStyles.premiumTag}>Premium</span>}
          <span style={{
            fontSize: fontSize.xs, fontWeight: fontWeight.bold, padding: "3px 8px",
            borderRadius: borderRadius.sm, background: badgeColor.bg, color: badgeColor.text,
            border: `0.5px solid ${badgeColor.border}`,
          }}>{resource.subject}</span>
        </div>
      </div>

      <div style={sharedStyles.cardTitle}>{resource.title}</div>

      {sourceName && (
        <div style={{
          fontSize: fontSize.xs, color: colors.textDim, marginBottom: spacing.sm,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>📎 {sourceName}</div>
      )}

      <div style={{
        fontSize: fontSize.sm, color: colors.textDim, marginBottom: spacing.md,
        display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap",
      }}>
        <span style={{
          fontSize: fontSize.xs, fontWeight: fontWeight.bold, padding: "2px 7px",
          borderRadius: borderRadius.sm, background: typeConfig.bg, color: typeConfig.color,
          border: `0.5px solid ${typeConfig.border}`,
        }}>{typeConfig.label}</span>
        <span>👁 {formatViewCount(resource.viewCount)}</span>
        {rating && <span>⭐ {rating}</span>}
        {saveCount > 0 && <span>· 🔖 {saveCount}</span>}
        {relDate && <span>· {relDate}</span>}
        {(resource.flagCount > 0) && <span style={{ color: colors.danger }}>· ⚑ {resource.flagCount}</span>}
      </div>

      <div style={{ display: "flex", gap: spacing.sm }}>
        <button onClick={() => onOpen(resource.shareToken)} style={sharedStyles.openBtn}>Open</button>
        <button onClick={() => onToggleBookmark(resource)} disabled={bookmarkBusy}
          title={isBookmarked ? "Remove from your space" : "Add to your space"}
          style={{ ...sharedStyles.iconActionBtn, color: isBookmarked ? "#f5a623" : "#5a6090" }}>
          {isBookmarked ? "★" : "☆"}
        </button>
        <button onClick={() => onShare(resource.shareToken)} style={sharedStyles.iconActionBtn}>🔗</button>
      </div>
    </div>
  );
});

export default ResourceCard;
