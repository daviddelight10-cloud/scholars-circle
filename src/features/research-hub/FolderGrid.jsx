import { getSubjectColor } from "./subjectColors";
import EmptyState from "./EmptyState";

function FolderCard({ folder, onClick, shared = false, index = 0 }) {
  const itemCount = folder._count?.resources ?? 0;
  const sc = getSubjectColor(folder.courseCode || folder.name);
  const delay = `${Math.min(index * 40, 400)}ms`;

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
          <div className="truncate text-sm font-bold text-hub-text">{folder.name}</div>
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
      </div>

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
