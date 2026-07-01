export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const fontSize = {
  xs: 10,
  sm: 11,
  base: 13,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 28,
};

export const fontWeight = {
  normal: 400,
  semibold: 600,
  bold: 700,
  extrabold: 800,
};

export const gold = "#FFD700";
export const goldDim = "rgba(255,215,0,0.15)";
export const goldBorder = "rgba(255,215,0,0.35)";
export const goldText = "#FFD700";

export const colors = {
  bg: "#0a0a0a",
  surface: "#141414",
  surfaceHover: "#1a1a1a",
  border: "#2a2a2a",
  borderActive: "#FFD700",
  accent: "#1a1a1a",
  accentLight: "#2a2a2a",
  accentGradient: "linear-gradient(135deg, #1a1a1a, #2a2a2a)",
  text: "#e8e8e8",
  textMuted: "#888888",
  textDim: "#555555",
  textBright: "#FFD700",
  success: "#4caf50",
  successBg: "#0f2a1a",
  successBorder: "#2a6a3a",
  warning: "#ffb74d",
  warningBg: "#1a1000",
  warningBorder: "#3a2800",
  danger: "#ff5470",
  dangerBg: "#2a0a0a",
  dangerBorder: "#4a1010",
  info: "#FFD700",
  purple: "#FFD700",
  purpleBg: "#1a1a00",
  purpleBorder: "rgba(255,215,0,0.35)",
};

export const contentTypeConfig = {
  pdf: { label: "PDF", icon: "📄", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  image: { label: "Image", icon: "🖼", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  docx: { label: "DOCX", icon: "📝", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  pptx: { label: "PPT", icon: "📊", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  txt: { label: "Text", icon: "📃", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  note: { label: "Note", icon: "📝", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  mcq: { label: "MCQ", icon: "✎", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  flashcard_deck: { label: "Flashcards", icon: "🎴", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
  tutorial_question: { label: "Tutorial Q", icon: "❓", bg: "#1a1a1a", border: "rgba(255,215,0,0.25)", color: "#FFD700" },
};

export const borderRadius = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 18,
  pill: 999,
};

export const shadows = {
  card: "0 2px 8px rgba(0,0,0,0.2)",
  cardHover: "0 4px 16px rgba(0,0,0,0.35)",
  modal: "0 8px 24px rgba(0,0,0,0.5)",
};

export const sharedStyles = {
  overlay: {
    position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
    background: "rgba(0,0,0,0.7)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: 1000,
  },
  modal: {
    background: colors.surface, border: `0.5px solid ${goldBorder}`,
    borderRadius: borderRadius.xl, padding: "26px", width: "100%",
    maxWidth: "460px", maxHeight: "86vh", overflowY: "auto",
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.extrabold, color: colors.textBright, margin: 0 },
  closeBtn: { background: "none", border: "none", color: colors.textDim, fontSize: fontSize.md, cursor: "pointer", padding: spacing.xs },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted, marginBottom: spacing.xs, display: "block" },
  input: {
    width: "100%", background: colors.bg, border: `0.5px solid ${colors.border}`,
    borderRadius: borderRadius.sm, padding: "10px 12px", fontSize: fontSize.base,
    color: "#e8e8e8", outline: "none", fontFamily: "inherit",
  },
  select: {
    background: "#111", border: `0.5px solid ${colors.border}`,
    borderRadius: borderRadius.md, padding: "10px 12px", fontSize: fontSize.base,
    color: "#e8e8e8", cursor: "pointer", outline: "none",
  },
  submit: {
    width: "100%", padding: spacing.md, background: goldDim,
    border: `0.5px solid ${goldBorder}`, borderRadius: borderRadius.lg,
    fontSize: fontSize.md, fontWeight: fontWeight.bold, color: goldText, cursor: "pointer",
  },
  segmentRow: {
    display: "flex", gap: spacing.sm, background: colors.bg,
    border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.md, padding: spacing.xs,
    marginBottom: spacing.lg,
  },
  seg: {
    flex: 1, padding: spacing.sm, borderRadius: borderRadius.sm, border: "none",
    background: "none", fontSize: fontSize.base, fontWeight: fontWeight.semibold,
    color: colors.textDim, cursor: "pointer",
  },
  segActive: {
    flex: 1, padding: spacing.sm, borderRadius: borderRadius.sm, border: "none",
    background: goldDim, fontSize: fontSize.base, fontWeight: fontWeight.bold,
    color: goldText, cursor: "pointer",
  },
  tab: {
    padding: "8px 14px", borderRadius: borderRadius.pill, background: "none",
    border: "none", fontSize: fontSize.base, fontWeight: fontWeight.semibold,
    color: colors.textDim, cursor: "pointer", display: "flex", alignItems: "center", gap: spacing.sm,
    flexShrink: 0, whiteSpace: "nowrap", minHeight: "36px",
  },
  tabActive: {
    padding: "8px 14px", borderRadius: borderRadius.pill, background: goldDim,
    border: `0.5px solid ${goldBorder}`, fontSize: fontSize.base, fontWeight: fontWeight.bold,
    color: goldText, cursor: "pointer", display: "flex", alignItems: "center", gap: spacing.sm,
    flexShrink: 0, whiteSpace: "nowrap", minHeight: "36px",
  },
  tabCount: { background: goldDim, color: goldText, borderRadius: borderRadius.pill, fontSize: fontSize.xs, padding: "1px 7px" },
  tabRow: {
    display: "flex", gap: spacing.xs, background: colors.bg,
    border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.pill,
    padding: spacing.xs, marginBottom: spacing.lg, width: "100%",
    alignItems: "center", overflowX: "auto", WebkitOverflowScrolling: "touch",
    scrollbarWidth: "none", msOverflowStyle: "none",
  },
  searchWrap: {
    display: "flex", alignItems: "center", gap: spacing.md, background: "#111",
    border: `0.5px solid ${colors.border}`, borderRadius: "22px", padding: "10px 16px",
  },
  searchInput: { flex: 1, background: "none", border: "none", outline: "none", fontSize: fontSize.md, color: "#e8e8e8" },
  chip: {
    padding: "6px 14px", borderRadius: "20px", background: "#111",
    border: `0.5px solid ${colors.border}`, fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
    color: colors.textMuted, cursor: "pointer", whiteSpace: "nowrap",
  },
  chipActive: {
    padding: "6px 14px", borderRadius: "20px", background: goldDim,
    border: `0.5px solid ${goldBorder}`, fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold, color: goldText, cursor: "pointer", whiteSpace: "nowrap",
  },
  sectionLabel: {
    fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textDim,
    letterSpacing: "1px", textTransform: "uppercase", marginBottom: spacing.md,
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
    gap: spacing.lg,
  },
  skeleton: {
    background: colors.surface, border: `0.5px solid ${colors.border}`,
    borderRadius: borderRadius.lg, padding: spacing.lg, height: "140px",
  },
  emptyState: { textAlign: "center", padding: "60px 20px", fontSize: fontSize.base, color: colors.textDim },
  card: {
    background: colors.surface, border: `0.5px solid ${colors.border}`,
    borderRadius: borderRadius.lg, padding: spacing.md, cursor: "pointer",
    transition: "borderColor 0.15s",
  },
  statPill: {
    background: colors.surface, border: `0.5px solid ${colors.border}`,
    borderRadius: borderRadius.lg, padding: "16px 20px", textAlign: "center", minWidth: "100px",
  },
  iconActionBtn: {
    width: "32px", height: "32px", background: "#111",
    border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.sm,
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: fontSize.base,
  },
  openBtn: {
    flex: 1, padding: spacing.sm, background: goldDim,
    border: `0.5px solid ${goldBorder}`, borderRadius: borderRadius.sm,
    fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: goldText,
    cursor: "pointer", textAlign: "center",
  },
  backBtn: {
    display: "flex", alignItems: "center", gap: spacing.sm, padding: "8px 12px",
    background: "#111", border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.sm,
    fontSize: fontSize.base, color: colors.textMuted, cursor: "pointer", marginBottom: spacing.xl,
  },
  addBtn: {
    padding: "10px 20px", background: goldDim,
    border: `0.5px solid ${goldBorder}`, borderRadius: borderRadius.sm,
    fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: goldText, cursor: "pointer",
  },
  folderGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: spacing.md,
  },
  folderCard: {
    background: colors.surface, border: `0.5px solid ${colors.border}`,
    borderRadius: borderRadius.lg, padding: spacing.lg, cursor: "pointer",
    transition: "borderColor 0.15s",
  },
  pendingTag: {
    fontSize: "9px", fontWeight: fontWeight.bold, padding: "3px 7px",
    borderRadius: borderRadius.sm, background: "rgba(255,84,112,0.14)",
    color: colors.danger, whiteSpace: "nowrap",
  },
  premiumTag: {
    fontSize: "9px", fontWeight: fontWeight.bold, padding: "3px 7px",
    borderRadius: borderRadius.sm, background: "rgba(245,166,35,0.14)",
    color: "#f5a623", whiteSpace: "nowrap",
  },
  cardTitle: {
    fontSize: "13.5px", fontWeight: fontWeight.bold, color: "#e8e8e8",
    lineHeight: 1.35, marginBottom: spacing.sm, minHeight: "36px",
  },
  dropzone: {
    display: "block", textAlign: "center", padding: "26px 14px",
    border: `1.5px dashed ${colors.border}`, borderRadius: borderRadius.lg,
    cursor: "pointer", marginBottom: spacing.md, transition: "all 0.15s",
  },
  modalFootnote: { fontSize: fontSize.xs, color: colors.textDim, marginTop: spacing.md, lineHeight: 1.4 },
  toast: {
    position: "fixed", bottom: "90px", left: "50%", transform: "translateX(-50%)",
    background: colors.surface, border: `0.5px solid ${goldBorder}`,
    color: goldText, padding: "10px 20px", borderRadius: "20px",
    fontSize: fontSize.base, fontWeight: fontWeight.semibold, zIndex: 999,
    display: "flex", alignItems: "center", gap: spacing.sm, animation: "fadeup 0.2s ease",
  },
};

export function formatRelativeDate(dateStr) {
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
