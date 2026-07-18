import { getSubjectColor } from "./subjectColors";

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
      <div className="mb-2 flex items-center justify-between">
        <div className="text-3xl">{shared ? "📂" : "📁"}</div>
        {itemCount > 0 && (
          <span className="rounded-full border border-gold-border bg-gold-dim px-2.5 py-0.5 text-[10px] font-bold text-gold">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </span>
        )}
      </div>

      <div className="mb-1 text-sm font-bold text-hub-text">{folder.name}</div>

      {folder.courseCode && (
        <div className="mb-2 text-[11px] text-hub-text-muted">{folder.courseCode}</div>
      )}

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
      <div className="px-5 py-16 text-center">
        <div className="mb-4 text-5xl">📁</div>
        <div className="mb-2 text-lg font-bold text-hub-text-muted">No folders yet</div>
        <div className="mx-auto mb-6 max-w-md text-[13px] leading-relaxed text-hub-text-dim">
          Create a folder to organize your study materials. You can make private folders or share them with your department.
        </div>
        <button onClick={onCreateFolder} className="rounded-lg border border-gold-border bg-gold-dim px-5 py-2 text-sm font-semibold text-gold transition-all active:scale-95">
          + Create your first folder
        </button>
      </div>
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
        <div className="px-5 py-12 text-center">
          <div className="mb-2 text-4xl">🔍</div>
          <div className="text-[13px] text-hub-text-dim">No folders match "{search}"</div>
        </div>
      )}
    </div>
  );
}
