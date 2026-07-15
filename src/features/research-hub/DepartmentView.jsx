import { useState, useMemo } from "react";
import { colors, spacing, fontSize, fontWeight, sharedStyles } from "./constants";
import SubjectDeckCard from "./SubjectDeckCard";
import SubjectDetailView from "./SubjectDetailView";
import FolderGrid from "./FolderGrid";
import SubTabBar from "./SubTabBar";

function groupByLevelThenSubject(resources) {
  const byLevel = {};
  for (const r of resources) {
    const level = r.level || "Unlevelled";
    const subject = r.subject || "General";
    if (!byLevel[level]) byLevel[level] = {};
    if (!byLevel[level][subject]) byLevel[level][subject] = [];
    byLevel[level][subject].push(r);
  }

  const sortedLevels = Object.keys(byLevel).sort((a, b) => {
    if (a === "Unlevelled") return 1;
    if (b === "Unlevelled") return -1;
    return a.localeCompare(b, undefined, { numeric: true });
  });

  return sortedLevels.map((level) => ({
    level,
    subjects: Object.keys(byLevel[level]).sort().map((subject) => ({
      subject,
      resources: byLevel[level][subject],
    })),
  }));
}

export default function DepartmentView({
  resources,
  resourcesLoading,
  resourcesError,
  onRetry,
  currentUserId,
  userProfile,
  fsrsStats,
  folders,
  bookmarkedIds,
  bookmarkBusyId,
  mcqProgress,
  onOpen,
  onToggleBookmark,
  onShare,
  onOpenFolder,
  onCreateFolder,
}) {
  const [search, setSearch] = useState("");
  const [expandedLevels, setExpandedLevels] = useState({});
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [subTab, setSubTab] = useState("materials");

  const deptResources = useMemo(() => {
    const deptId = userProfile?.departmentId;
    const deptName = userProfile?.department?.name || userProfile?.department;
    return resources.filter((r) => {
      if (r.status === "rejected") return false;
      if (r.status === "pending" && String(r.uploadedBy) !== currentUserId) return false;
      if (deptId && r.resourceDepts) {
        return r.resourceDepts.some((rd) => String(rd.department?.id) === String(deptId));
      }
      if (deptName && r.department === deptName) return true;
      if (deptName && r.resourceDepts) {
        return r.resourceDepts.some((rd) => rd.department?.name === deptName);
      }
      return false;
    });
  }, [resources, userProfile, currentUserId]);

  const grouped = useMemo(() => {
    let result = groupByLevelThenSubject(deptResources);
    if (search) {
      const q = search.toLowerCase();
      result = result
        .map((levelGroup) => ({
          ...levelGroup,
          subjects: levelGroup.subjects.filter((s) =>
            s.subject.toLowerCase().includes(q) ||
            s.resources.some((r) => r.title?.toLowerCase().includes(q))
          ),
        }))
        .filter((lg) => lg.subjects.length > 0);
    }
    return result;
  }, [deptResources, search]);

  const toggleLevel = (level) => {
    setExpandedLevels((prev) => ({ ...prev, [level]: !prev[level] }));
  };

  const hasDepartment = userProfile?.departmentId || userProfile?.department?.name || userProfile?.department;

  const sharedFolderCount = folders?.shared?.length || 0;
  const subTabs = [
    ["materials", "Materials"],
    ["folders", "Folders", sharedFolderCount],
  ];

  const filteredSharedFolders = useMemo(() => {
    if (!folders?.shared) return [];
    if (!search) return folders.shared;
    const q = search.toLowerCase();
    return folders.shared.filter((f) => f.name.toLowerCase().includes(q));
  }, [folders, search]);

  if (selectedSubject) {
    return (
      <SubjectDetailView
        subject={selectedSubject.subject}
        level={selectedSubject.level}
        resources={selectedSubject.resources}
        fsrsSubjectStats={fsrsStats?.bySubject?.[selectedSubject.subject]}
        onBack={() => setSelectedSubject(null)}
        onOpen={onOpen}
        onToggleBookmark={onToggleBookmark}
        onShare={onShare}
        bookmarkedIds={bookmarkedIds}
        bookmarkBusyId={bookmarkBusyId}
        mcqProgress={mcqProgress}
        backLabel="Department"
      />
    );
  }

  if (resourcesLoading) {
    return (
      <div style={sharedStyles.emptyState}>
        <div style={{ fontSize: 36, marginBottom: spacing.sm }}>⏳</div>
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
          Loading department materials…
        </div>
        <div style={{ fontSize: fontSize.base, color: colors.textDim }}>
          Fetching materials for your department.
        </div>
      </div>
    );
  }

  if (resourcesError) {
    return (
      <div style={sharedStyles.emptyState}>
        <div style={{ fontSize: 36, marginBottom: spacing.sm }}>⚠️</div>
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.xs }}>
          Something went wrong
        </div>
        <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5, marginBottom: spacing.md }}>
          {resourcesError}
        </div>
        <button onClick={onRetry} style={{ ...sharedStyles.chipActive, cursor: "pointer" }}>↻ Retry</button>
      </div>
    );
  }

  if (!hasDepartment) {
    return (
      <div style={sharedStyles.emptyState}>
        <div style={{ fontSize: 48, marginBottom: spacing.md }}>🏛️</div>
        <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.sm }}>
          No department set
        </div>
        <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
          Set your department from the profile or onboarding screen to see department-specific materials here.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: spacing.sm, marginBottom: spacing.lg, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ ...sharedStyles.searchWrap, flex: "1 1 200px" }}>
          <span style={{ color: "#3a3d60", fontSize: fontSize.lg }}>🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={subTab === "materials" ? "Search subjects or materials…" : "Search department folders…"}
            style={sharedStyles.searchInput} />
        </div>
      </div>

      <SubTabBar tabs={subTabs} activeTab={subTab} onTabChange={setSubTab} />

      {subTab === "materials" ? (
        grouped.length === 0 ? (
          <div style={sharedStyles.emptyState}>
            <div style={{ fontSize: 48, marginBottom: spacing.md }}>📚</div>
            <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textMuted, marginBottom: spacing.sm }}>
              {search ? "No results found" : "No department materials yet"}
            </div>
            <div style={{ fontSize: fontSize.base, color: colors.textDim, maxWidth: 400, margin: "0 auto", lineHeight: 1.5 }}>
              {search
                ? "Try a different search term."
                : "Materials uploaded to your department will appear here, grouped by level."}
            </div>
          </div>
        ) : (
          grouped.map((levelGroup) => {
            const isExpanded = expandedLevels[levelGroup.level] !== false;
            const totalItems = levelGroup.subjects.reduce((sum, s) => sum + s.resources.length, 0);
            const totalDue = levelGroup.subjects.reduce((sum, s) => {
              const stats = fsrsStats?.bySubject?.[s.subject];
              return sum + (stats?.due || 0);
            }, 0);

            return (
              <div key={levelGroup.level} style={{ marginBottom: spacing.xl }}>
                <button
                  onClick={() => toggleLevel(levelGroup.level)}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "10px 16px", marginBottom: spacing.md,
                    background: colors.surface, border: `0.5px solid ${colors.border}`,
                    borderRadius: "12px", cursor: "pointer",
                    fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.text,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: spacing.sm }}>
                    <span style={{ fontSize: 14 }}>{isExpanded ? "▼" : "▶"}</span>
                    <span>{levelGroup.level} Level</span>
                    <span style={{
                      fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
                      color: colors.textDim, background: colors.bg,
                      padding: "2px 10px", borderRadius: "12px",
                    }}>{totalItems} items</span>
                    {totalDue > 0 && (
                      <span style={{
                        fontSize: fontSize.xs, fontWeight: fontWeight.bold,
                        color: "#ef4444", background: "rgba(239,68,68,0.12)",
                        padding: "2px 10px", borderRadius: "12px",
                      }}>{totalDue} due</span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div style={sharedStyles.grid}>
                    {levelGroup.subjects.map((s) => (
                      <SubjectDeckCard
                        key={s.subject}
                        subject={s.subject}
                        level={levelGroup.level}
                        resources={s.resources}
                        fsrsSubjectStats={fsrsStats?.bySubject?.[s.subject]}
                        onClick={() => setSelectedSubject({
                          subject: s.subject,
                          level: levelGroup.level,
                          resources: s.resources,
                        })}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )
      ) : (
        <FolderGrid
          folders={[]}
          sharedFolders={filteredSharedFolders}
          search={search}
          onOpenFolder={onOpenFolder}
          onCreateFolder={onCreateFolder}
        />
      )}
    </div>
  );
}
