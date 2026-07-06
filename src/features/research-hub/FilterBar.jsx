import { useMemo, useState } from "react";
import { colors, spacing, fontSize, fontWeight, borderRadius, sharedStyles, goldDim, goldBorder, goldText } from "./constants";

export default function FilterBar({ filters, setFilters, resources, universities }) {
  const [expanded, setExpanded] = useState(false);

  const universityNames = useMemo(() => {
    const set = new Set();
    for (const r of resources) {
      if (r.university?.name) set.add(r.university.name);
    }
    return Array.from(set).sort();
  }, [resources]);

  const departments = useMemo(() => {
    const set = new Set(resources.map((r) => r.department).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const levels = useMemo(() => {
    const set = new Set(resources.map((r) => r.level).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const semesters = useMemo(() => {
    const set = new Set(resources.map((r) => r.semester).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const subjects = useMemo(() => {
    const set = new Set(resources.map((r) => r.subject).filter(Boolean));
    return Array.from(set).sort();
  }, [resources]);

  const activeCount = ["university", "department", "level", "semester", "subject"].filter((k) => filters[k] !== "all").length;

  const clearAll = () => {
    setFilters({ university: "all", department: "all", level: "all", semester: "all", subject: "all" });
  };

  const selectStyle = {
    background: "#111", border: `0.5px solid ${activeCount > 0 ? colors.borderActive : colors.border}`,
    borderRadius: borderRadius.sm, padding: "7px 10px", fontSize: fontSize.sm,
    color: "#e8e8e8", cursor: "pointer", outline: "none",
  };

  return (
    <div style={{ marginBottom: spacing.lg }}>
      <div style={{
        display: "flex", alignItems: "center", gap: spacing.sm, flexWrap: "wrap",
      }}>
        <button onClick={() => setExpanded((v) => !v)} style={{
          ...sharedStyles.chip,
          background: activeCount > 0 ? goldDim : "#111",
          borderColor: activeCount > 0 ? goldBorder : colors.border,
          color: activeCount > 0 ? goldText : colors.textMuted,
          display: "flex", alignItems: "center", gap: spacing.xs,
        }}>
          <span>🔧 Filters</span>
          {activeCount > 0 && (
            <span style={{
              background: goldDim, color: goldText, borderRadius: borderRadius.pill,
              fontSize: fontSize.xs, padding: "1px 6px",
            }}>{activeCount}</span>
          )}
          <span style={{ fontSize: fontSize.xs, opacity: 0.6 }}>{expanded ? "▲" : "▼"}</span>
        </button>

        {activeCount > 0 && (
          <button onClick={clearAll} style={{
            ...sharedStyles.chip,
            background: "transparent", borderColor: "transparent",
            color: colors.info, fontSize: fontSize.xs, padding: "4px 8px",
          }}>Clear all</button>
        )}
      </div>

      {expanded && (
        <div style={{
          display: "flex", gap: spacing.sm, flexWrap: "wrap", marginTop: spacing.sm,
          padding: spacing.md, background: colors.surface,
          border: `0.5px solid ${colors.border}`, borderRadius: borderRadius.lg,
        }}>
          {universityNames.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: "160px", flex: "1 1 160px" }}>
              <label style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textMuted }}>University</label>
              <select value={filters.university || "all"} onChange={(e) => setFilters((p) => ({ ...p, university: e.target.value }))} style={selectStyle}>
                <option value="all">All universities</option>
                {universityNames.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: "140px", flex: "1 1 140px" }}>
            <label style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Department</label>
            <select value={filters.department} onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))} style={selectStyle}>
              <option value="all">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: "120px", flex: "1 1 120px" }}>
            <label style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Level</label>
            <select value={filters.level} onChange={(e) => setFilters((p) => ({ ...p, level: e.target.value }))} style={selectStyle}>
              <option value="all">All levels</option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: "130px", flex: "1 1 130px" }}>
            <label style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Semester</label>
            <select value={filters.semester} onChange={(e) => setFilters((p) => ({ ...p, semester: e.target.value }))} style={selectStyle}>
              <option value="all">All semesters</option>
              {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: spacing.xs, minWidth: "140px", flex: "1 1 140px" }}>
            <label style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.textMuted }}>Subject</label>
            <select value={filters.subject} onChange={(e) => setFilters((p) => ({ ...p, subject: e.target.value }))} style={selectStyle}>
              <option value="all">All subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
