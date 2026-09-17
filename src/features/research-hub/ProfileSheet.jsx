import { useMemo } from "react";
import CircleSheet from "./CircleSheet.jsx";
import McIcon from "./McIcon.jsx";

/**
 * Lecturer / student profile sheet — prototype "lecturer-sheet".
 * `owner` comes from a community folder's owner object; `folders` is the
 * owner's folder list (grouped client-side from the community list).
 */
export default function ProfileSheet({ open, onClose, owner, folders = [], onOpenFolder }) {
  const isLecturer = owner?.role === "LECTURER" || owner?.role === "TEACHER";
  const isVerified = isLecturer && owner?.lecturerProfile?.isVerified !== false;

  const profile = useMemo(() => {
    const lec = owner?.lecturerProfile;
    const usr = owner?.userProfile;
    const name = lec?.fullName || usr?.fullName || owner?.username || "Unknown";
    let role;
    if (isLecturer) {
      const title = lec?.title ? `${lec.title} ` : "";
      const dept = lec?.department || lec?.institution || "Faculty";
      role = `${title}${name?.split(" ").slice(-1)[0] || ""} · ${dept}`.trim();
      if (lec?.title && lec?.department) role = `${lec.title} · ${lec.department}`;
    } else if (usr) {
      const parts = [usr.level, usr.programme || usr.department].filter(Boolean);
      role = parts.length > 0 ? parts.join(" · ") : "Student";
    } else {
      role = "Student";
    }
    return {
      name,
      role,
      bio: lec?.bio || usr?.bio || null,
      institution: lec?.institution || null,
      initial: (name || "?").charAt(0).toUpperCase(),
    };
  }, [owner, isLecturer]);

  const stats = useMemo(() => {
    const list = folders || [];
    const materials = list.reduce((sum, f) => sum + (f._count?.resources || 0), 0);
    const saves = list.reduce((sum, f) => sum + (f._count?.folderBookmarks || 0), 0);
    return { folders: list.length, materials, saves };
  }, [folders]);

  if (!owner) return null;

  return (
    <CircleSheet open={open} onClose={onClose}>
      <div className="mc-lec-head">
        <span className="mc-ava big">
          {profile.initial}
          {isVerified && <span className="mc-mini-v"><McIcon name="verify" /></span>}
        </span>
        <h2>
          {profile.name}
          {isVerified && (
            <span className="mc-vbadge" title="Verified lecturer"><McIcon name="verify" /></span>
          )}
        </h2>
        <p className="mc-lec-role">{profile.role}</p>
        {(profile.institution || folders[0]?.university?.name) && (
          <span className="mc-uni">
            <McIcon name="landmark" />
            <span>{profile.institution || folders[0].university.name}</span>
          </span>
        )}
      </div>

      <div className="mc-lec-stats">
        <div className="mc-lstat"><b>{stats.folders}</b><span>Folders</span></div>
        <div className="mc-lstat"><b>{stats.materials}</b><span>Materials</span></div>
        <div className="mc-lstat"><b>{stats.saves}</b><span>Saves</span></div>
      </div>

      {profile.bio && <p className="mc-bio">{profile.bio}</p>}

      {folders.length > 0 && (
        <>
          <div className="mc-section-label">FOLDERS BY {(profile.name || "").toUpperCase()}</div>
          {folders.map((f) => (
            <div key={f.id} className="mc-lec-f-row" onClick={() => { onClose(); onOpenFolder?.(f.id); }}>
              <div className="mc-tile"><McIcon name="folder" /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mc-lec-f-name">
                  {f.name}
                  {isVerified && <span className="mc-vbadge"><McIcon name="verify" /></span>}
                </div>
                <div className="mc-lec-f-sub">{[f.level, f.semester].filter(Boolean).join(" · ") || f.courseCode || "Shared folder"}</div>
              </div>
              <span className="mc-count-badge">{f._count?.resources ?? 0}</span>
            </div>
          ))}
        </>
      )}
    </CircleSheet>
  );
}
