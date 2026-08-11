import { getSubjectColor } from "./subjectColors";
import EmptyState from "./EmptyState";

export function FolderCard({ folder, onClick, shared = false, index = 0, isBookmarked, bookmarkBusy, onToggleBookmark }) {
  const itemCount = folder._count?.resources ?? 0;
  const bookmarkCount = folder._count?.folderBookmarks ?? 0;
  const sc = getSubjectColor(folder.courseCode || folder.name);
  const delay = `${Math.min(index * 40, 400)}ms`;

  const daysSinceCreated = Math.floor((Date.now() - new Date(folder.createdAt).getTime()) / 86400000);
  const qualityBadge = bookmarkCount >= 10
    ? { icon: "🔥", label: "Hot", color: "#ef4444", bg: "rgba(239,68,68,0.12)" }
    : bookmarkCount >= 5
      ? { icon: "⭐", label: "Trusted", color: "#FFD700", bg: "rgba(255,215,0,0.12)" }
      : daysSinceCreated <= 7
        ? { icon: "🆕", label: "New", color: "#22c55e", bg: "rgba(34,197,94,0.12)" }
        : null;

  const deptNames = (folder.folderDepts || []).map((fd) => fd.department?.name).filter(Boolean).slice(0, 2);

  return (
    <div
      className="stagger-in cursor-pointer rounded-xl border border-hub-border bg-hub-surface p-4 transition-all duration-150 active:scale-[0.97] hover:-translate-y-0.5 hover:border-hub-border-active"
      style={{ borderLeftWidth: "3px", borderLeftColor: sc.accent, animationDelay: delay }}
      onClick={onClick}
    >
      <div className="mb-3 flex items-center gap-3">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border text-2xl"
          style={{ background: sc.bg, borderColor: sc.border }}
        >
          {shared ? "📂" : "📁"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm font-bold text-hub-text">{folder.name}</div>
            {qualityBadge && (
              <span
                className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold"
                style={{ color: qualityBadge.color, background: qualityBadge.bg }}
              >
                {qualityBadge.icon} {qualityBadge.label}
              </span>
            )}
          </div>
          {folder.courseCode && (
            <div className="mt-0.5 text-[11px] text-hub-text-dim">{folder.courseCode}</div>
          )}
        </div>
        {itemCount > 0 && (
          <span className="shrink-0 rounded-full border border-gold-border bg-gold-dim px-2.5 py-0.5 text-[10px] font-bold text-gold">
            {itemCount}
          </span>
        )}
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {folder.level && (
          <span className="rounded border border-gold-border bg-hub-bg px-2 py-0.5 text-[10px] text-gold">{folder.level}</span>
        )}
        {folder.semester && (
          <span className="rounded border border-success-border bg-success-bg px-2 py-0.5 text-[10px] text-success-text">{folder.semester}</span>
        )}
        {deptNames.map((dept) => (
          <span key={dept} className="rounded border border-hub-border bg-hub-bg px-2 py-0.5 text-[10px] text-hub-text-muted">
            {dept}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className="rounded px-2 py-0.5 text-[10px]"
            style={{
              background: folder.visibility === "private" ? "#1a0808" : "#0f2a1a",
              color: folder.visibility === "private" ? "#ef9a9a" : "#a5d6a7",
              border: `0.5px solid ${folder.visibility === "private" ? "#4a1010" : "#2a6a3a"}`,
            }}
          >
            {folder.visibility === "private" ? "🔒 Private" : folder.visibility === "link" ? "🔗 Link" : "👥 Shared"}
          </span>
          {shared && folder.owner?.username && (
            <span className="text-[10px] text-hub-text-dim">by {folder.owner.username}</span>
          )}
          {shared && bookmarkCount > 0 && (
            <span className="text-[10px] font-semibold text-gold">★ {bookmarkCount}</span>
          )}
          {folder.university?.name && (
            <span className="rounded px-2 py-0.5 text-[10px] text-hub-text-dim" style={{ background: "rgba(90,97,120,0.08)" }}>
              🏫 {folder.university.name}
            </span>
          )}
        </div>
        {onToggleBookmark && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(folder); }}
            disabled={bookmarkBusy}
            title={isBookmarked ? "Remove from your space" : "Add to your space"}
            className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-lg border border-hub-border bg-transparent text-sm transition-all active:scale-90"
            style={isBookmarked
              ? { color: "#F5A623", borderColor: "rgba(245,166,35,0.4)", background: "rgba(245,166,35,0.08)" }
              : { color: "#5A6178" }}
          >
            {isBookmarked ? "★" : "☆"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function FolderGrid({ folders, sharedFolders, search, onOpenFolder, onCreateFolder }) {
  const filteredOwn = (folders || []).filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const filteredShared = (sharedFolders || []).filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const hasAny = filteredOwn.length > 0 || filteredShared.length > 0;

  if (!hasAny && !search) {
    return (
      <EmptyState
        icon="📁"
        title="No folders yet"
        message="Create a folder to organize your study materials. You can make private folders or share them with your department."
        action={
          <button onClick={onCreateFolder} className="rounded-lg border border-gold-border bg-gold-dim px-5 py-2 text-sm font-semibold text-gold transition-all active:scale-95">
            + Create your first folder
          </button>
        }
      />
    );
  }

  return (
    <div>
      {filteredOwn.length > 0 && (
        <div className="mb-8">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">My Folders</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredOwn.map((folder, i) => (
              <FolderCard key={folder.id} folder={folder} onClick={() => onOpenFolder(folder.id)} index={i} />
            ))}
          </div>
        </div>
      )}

      {filteredShared.length > 0 && (
        <div>
          <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-hub-text-dim">Shared With Me</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredShared.map((folder, i) => (
              <FolderCard key={folder.id} folder={folder} shared onClick={() => onOpenFolder(folder.id)} index={i} />
            ))}
          </div>
        </div>
      )}

      {!hasAny && search && (
        <EmptyState icon="🔍" message={`No folders match "${search}"`} />
      )}
    </div>
  );
}
