import { colors, spacing, fontSize, fontWeight, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

export default function FsrsReviewDashboard({ fsrsDue, fsrsStats, onOpenPdf }) {
  if (!fsrsStats) return <div style={sharedStyles.emptyState}>Loading FSRS review data...</div>;

  const { totalItems, dueCount, learningCount, masteredCount, streak } = fsrsStats;
  const masteryPct = totalItems > 0 ? Math.round((masteredCount / totalItems) * 100) : 0;

  if (totalItems === 0) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: 48, marginBottom: spacing.md }}>📚</div>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.sm }}>No PDF review items yet</div>
        <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
          Open any PDF in the Research Hub and rate your understanding after reading. The FSRS algorithm will schedule when to revisit each page and the whole document.
        </div>
      </div>
    );
  }

  const duePagesByResource = new Map();
  if (fsrsDue?.pages) {
    for (const p of fsrsDue.pages) {
      const key = p.resourceId;
      if (!duePagesByResource.has(key)) duePagesByResource.set(key, { resource: p.resource, pages: [] });
      duePagesByResource.get(key).pages.push(p);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", gap: spacing.md, flexWrap: "wrap", marginBottom: spacing.xl }}>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: dueCount > 0 ? "#ef4444" : colors.textMuted }}>{dueCount}</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Due now</div>
        </div>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#f59e0b" }}>{learningCount}</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Learning</div>
        </div>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#22c55e" }}>{masteredCount}</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Mastered</div>
        </div>
        <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: goldText }}>{totalItems}</div>
          <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Total items</div>
        </div>
        {streak > 0 && (
          <div style={{ ...sharedStyles.statPill, minWidth: 80 }}>
            <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.extrabold, color: "#ff7043" }}>{streak}</div>
            <div style={{ fontSize: fontSize.xs, color: colors.textDim, marginTop: 2 }}>Day streak</div>
          </div>
        )}
      </div>

      <div style={{ marginBottom: spacing.xl }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Mastery Progress</span>
          <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: "#22c55e" }}>{masteredCount}/{totalItems} ({masteryPct}%)</span>
        </div>
        <div style={{ height: 8, background: colors.bg, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${masteryPct}%`, background: "linear-gradient(90deg, #22c55e, #4caf50)", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      {fsrsDue?.wholePdfs?.length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <div style={sharedStyles.sectionLabel}>PDFs to Re-read</div>
          <div style={sharedStyles.grid}>
            {fsrsDue.wholePdfs.map((item) => (
              <div key={item.id} style={sharedStyles.card} onClick={() => onOpenPdf(item.resource?.shareToken)}>
                <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: "#e8e8e8", marginBottom: "6px" }}>{item.resource?.title}</div>
                <div style={{ fontSize: fontSize.sm, color: colors.textDim }}>{item.resource?.subject}</div>
                <div style={{ marginTop: spacing.sm, display: "flex", gap: spacing.sm, alignItems: "center" }}>
                  <span style={{ fontSize: fontSize.xs, color: "#ef4444", fontWeight: fontWeight.semibold }}>Due now</span>
                  <span style={{ fontSize: fontSize.xs, color: colors.textDim }}>Reps: {item.reps}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {duePagesByResource.size > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <div style={sharedStyles.sectionLabel}>Pages to Review</div>
          {Array.from(duePagesByResource.entries()).map(([resId, group]) => (
            <div key={resId} style={{ ...sharedStyles.card, marginBottom: 10, cursor: "default" }}>
              <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: "#e8e8e8", marginBottom: spacing.sm }}>{group.resource?.title}</div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {group.pages.map((p) => (
                  <button key={p.id} onClick={() => onOpenPdf(group.resource?.shareToken, p.pageIndex)}
                    style={{ padding: "5px 12px", borderRadius: 8, background: goldDim, border: `0.5px solid ${goldBorder}`, color: goldText, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, cursor: "pointer" }}>
                    p.{p.pageIndex}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {fsrsDue?.flashcards?.length > 0 && (
        <div style={{ marginBottom: spacing.xl }}>
          <div style={sharedStyles.sectionLabel}>Flashcards Due</div>
          <div style={{ ...sharedStyles.card, cursor: "default" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, color: "#e8e8e8" }}>{fsrsDue.flashcards.length} flashcard{fsrsDue.flashcards.length > 1 ? "s" : ""} due</div>
                <div style={{ fontSize: fontSize.sm, color: colors.textDim, marginTop: spacing.xs }}>
                  Across {new Set(fsrsDue.flashcards.map((f) => f.resourceId)).size} PDF{new Set(fsrsDue.flashcards.map((f) => f.resourceId)).size > 1 ? "s" : ""}
                </div>
              </div>
              <button onClick={() => {
                const first = fsrsDue.flashcards[0];
                if (first?.resource?.shareToken) onOpenPdf(first.resource.shareToken);
              }}
                style={{ padding: "8px 16px", borderRadius: 8, background: goldDim, border: `0.5px solid ${goldBorder}`, color: goldText, fontSize: fontSize.sm, fontWeight: fontWeight.bold, cursor: "pointer" }}>
                Start Review →
              </button>
            </div>
          </div>
        </div>
      )}

      {dueCount === 0 && totalItems > 0 && (
        <div style={{ textAlign: "center", padding: "40px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: spacing.sm }}>✅</div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: "#22c55e" }}>All caught up!</div>
          <div style={{ fontSize: fontSize.sm, color: colors.textDim, marginTop: spacing.xs }}>No items due for review right now. Come back later.</div>
        </div>
      )}
    </div>
  );
}
