import { useState, useMemo } from "react";
import SubjectDeckCard from "./SubjectDeckCard";
import SubjectDetailView from "./SubjectDetailView";
import FolderGrid from "./FolderGrid";
import SubTabBar from "./SubTabBar";
import EmptyState from "./EmptyState";
import LoadingState from "./LoadingState";
import ErrorState from "./ErrorState";

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
  onSpacedReview,
  onAdaptiveDrill,
  onExamSimulation,
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
        onStudySubject={() => onSpacedReview?.(selectedSubject.subject, selectedSubject.resources.filter(r => r.contentType === 'mcq').map(r => r.id))}
        onAdaptiveDrill={() => onAdaptiveDrill?.(selectedSubject.subject, selectedSubject.resources.filter(r => r.contentType === 'mcq').map(r => r.id))}
        onExamSimulation={() => onExamSimulation?.(selectedSubject.subject, selectedSubject.resources.filter(r => r.contentType === 'mcq').map(r => r.id))}
        backLabel="Department"
      />
    );
  }

  if (resourcesLoading) {
    return <LoadingState grid count={4} />;
  }

  if (resourcesError) {
    return <ErrorState message={resourcesError} onRetry={onRetry} />;
  }

  if (!hasDepartment) {
    return (
      <EmptyState
        icon="🏛️"
        title="No department set"
        message="Set your department from the profile or onboarding screen to see department-specific materials here."
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-h-[40px] flex-1 items-center gap-3 rounded-full border border-hub-border bg-hub-bg px-4 py-2">
          <span className="text-lg text-hub-text-dim">🔍</span>
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={subTab === "materials" ? "Search subjects or materials…" : "Search department folders…"}
            className="flex-1 border-none bg-none text-sm text-hub-text outline-none placeholder:text-hub-text-dim" />
        </div>
      </div>

      <SubTabBar tabs={subTabs} activeTab={subTab} onTabChange={setSubTab} />

      {subTab === "materials" ? (
        grouped.length === 0 ? (
          <EmptyState
            icon="📚"
            title={search ? "No results found" : "No department materials yet"}
            message={search
              ? "Try a different search term."
              : "Materials uploaded to your department will appear here, grouped by level."}
          />
        ) : (
          grouped.map((levelGroup) => {
            const isExpanded = expandedLevels[levelGroup.level] !== false;
            const totalItems = levelGroup.subjects.reduce((sum, s) => sum + s.resources.length, 0);
            const totalDue = levelGroup.subjects.reduce((sum, s) => {
              const stats = fsrsStats?.bySubject?.[s.subject];
              return sum + (stats?.due || 0);
            }, 0);

            return (
              <div key={levelGroup.level} className="mb-8">
                <button
                  onClick={() => toggleLevel(levelGroup.level)}
                  className="flex w-full items-center justify-between rounded-xl border border-hub-border bg-hub-surface px-4 py-2.5 text-sm font-bold text-hub-text transition-all active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{isExpanded ? "▼" : "▶"}</span>
                    <span>{levelGroup.level} Level</span>
                    <span className="rounded-full bg-hub-bg px-2.5 py-0.5 text-[10px] font-semibold text-hub-text-dim">{totalItems} items</span>
                    {totalDue > 0 && (
                      <span className="due-pulse rounded-full border border-coral-300 bg-coral-100 px-2.5 py-0.5 text-[10px] font-bold text-coral-400">{totalDue} due</span>
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {levelGroup.subjects.map((s, i) => (
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
                        index={i}
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
