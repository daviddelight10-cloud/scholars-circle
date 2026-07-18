import { useMemo, useState } from "react";

export default function FilterBar({ filters, setFilters, resources }) {
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

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95 ${
            activeCount > 0
              ? "border border-gold-border bg-gold-dim text-gold"
              : "border border-hub-border bg-hub-bg text-hub-text-muted"
          }`}
        >
          <span>🔧 Filters</span>
          {activeCount > 0 && (
            <span className="rounded-full bg-gold-dim px-1.5 py-0.5 text-[10px] text-gold">{activeCount}</span>
          )}
          <span className="text-[10px] opacity-60">{expanded ? "▲" : "▼"}</span>
        </button>

        {activeCount > 0 && (
          <button onClick={clearAll} className="rounded-full px-2 py-1 text-[10px] text-gold transition-colors hover:text-gold-dim">
            Clear all
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 flex flex-wrap gap-2 rounded-xl border border-hub-border bg-hub-surface p-3">
          {universityNames.length > 0 && (
            <div className="flex min-w-[160px] flex-1 flex-col gap-1">
              <label className="text-[10px] font-semibold text-hub-text-muted">University</label>
              <select value={filters.university || "all"} onChange={(e) => setFilters((p) => ({ ...p, university: e.target.value }))}
                className="rounded-lg border border-hub-border bg-hub-bg px-2.5 py-1.5 text-[11px] text-hub-text outline-none cursor-pointer">
                <option value="all">All universities</option>
                {universityNames.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          )}
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold text-hub-text-muted">Department</label>
            <select value={filters.department} onChange={(e) => setFilters((p) => ({ ...p, department: e.target.value }))}
              className="rounded-lg border border-hub-border bg-hub-bg px-2.5 py-1.5 text-[11px] text-hub-text outline-none cursor-pointer">
              <option value="all">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex min-w-[120px] flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold text-hub-text-muted">Level</label>
            <select value={filters.level} onChange={(e) => setFilters((p) => ({ ...p, level: e.target.value }))}
              className="rounded-lg border border-hub-border bg-hub-bg px-2.5 py-1.5 text-[11px] text-hub-text outline-none cursor-pointer">
              <option value="all">All levels</option>
              {levels.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="flex min-w-[130px] flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold text-hub-text-muted">Semester</label>
            <select value={filters.semester} onChange={(e) => setFilters((p) => ({ ...p, semester: e.target.value }))}
              className="rounded-lg border border-hub-border bg-hub-bg px-2.5 py-1.5 text-[11px] text-hub-text outline-none cursor-pointer">
              <option value="all">All semesters</option>
              {semesters.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex min-w-[140px] flex-1 flex-col gap-1">
            <label className="text-[10px] font-semibold text-hub-text-muted">Subject</label>
            <select value={filters.subject} onChange={(e) => setFilters((p) => ({ ...p, subject: e.target.value }))}
              className="rounded-lg border border-hub-border bg-hub-bg px-2.5 py-1.5 text-[11px] text-hub-text outline-none cursor-pointer">
              <option value="all">All subjects</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
