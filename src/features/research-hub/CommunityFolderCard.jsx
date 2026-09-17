import { memo, useCallback } from "react";
import McIcon from "./McIcon.jsx";

const ACCENTS = ["", "acc-green", "acc-pink", "acc-blue"];

function stableHash(str) {
  let h = 0;
  for (let i = 0; i < (str || "").length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function freshnessTag(folder) {
  const updated = new Date(folder.updatedAt || folder.createdAt || 0).getTime();
  if (!updated) return null;
  const days = Math.floor((Date.now() - updated) / 86400000);
  if (days <= 30) return { cls: "fresh", label: `Updated ${days <= 0 ? "today" : `${days}d ago`}` };
  if (days > 365) {
    const years = Math.floor(days / 365);
    return { cls: "stale", label: `${years} year${years > 1 ? "s" : ""} old` };
  }
  return null;
}

/**
 * Community folder card — prototype "c-card".
 * Owner area is tappable → profile sheet; ⋮ opens card actions; bookmark saves to My Space.
 */
function CommunityFolderCard({
  folder,
  onClick,
  isBookmarked,
  bookmarkBusy,
  onToggleBookmark,
  onOpenProfile,
  onOpenActions,
}) {
  const itemCount = folder._count?.resources ?? 0;
  const bookmarkCount = folder._count?.folderBookmarks ?? 0;
  const owner = folder.owner || {};
  const isLecturer = owner.role === "LECTURER" || owner.role === "TEACHER";
  const isVerified = isLecturer && (owner.lecturerProfile?.isVerified !== false);
  const accent = ACCENTS[stableHash(folder.id || folder.name) % ACCENTS.length];
  const fresh = freshnessTag(folder);
  const displayName = owner.lecturerProfile?.fullName || owner.userProfile?.fullName || owner.username || "Unknown";

  const stop = useCallback((e) => e.stopPropagation(), []);

  return (
    <div className={`mc-c-card ${accent}`} onClick={onClick}>
      <div className="mc-c-top">
        <div className="mc-tile">
          <McIcon name="folder" />
        </div>
        <div className="mc-c-main">
          <div className="mc-c-titleline">
            <h3>{folder.name}</h3>
            {isVerified && (
              <span className="mc-vbadge" title="Verified lecturer">
                <McIcon name="verify" />
              </span>
            )}
            <span className="mc-count-badge">{itemCount}</span>
          </div>
          {folder.courseCode && <span className="mc-c-sub">{folder.courseCode}</span>}
        </div>
        {onOpenActions && (
          <button
            className="mc-c-more"
            title="More"
            onClick={(e) => { e.stopPropagation(); onOpenActions(folder); }}
          >
            <McIcon name="more" />
          </button>
        )}
      </div>

      <div className="mc-c-tags">
        {isLecturer && (
          <span className="mc-tag lec"><McIcon name="verify" />Verified lecturer</span>
        )}
        {folder.level && <span className="mc-tag level">{folder.level}</span>}
        {folder.semester && <span className="mc-tag sem">{folder.semester}</span>}
        {fresh && <span className={`mc-tag ${fresh.cls}`}>{fresh.label}</span>}
        <span className={`mc-pill ${folder.visibility === "private" ? "private" : "link"}`}>
          <McIcon name={folder.visibility === "private" ? "lock" : "link"} />
          {folder.visibility === "private" ? "Private" : "Link"}
        </span>
      </div>

      <div className="mc-c-foot">
        {onOpenProfile ? (
          <>
            <button className="mc-ava-btn" onClick={(e) => { stop(e); onOpenProfile(owner); }} title={`View ${displayName}`}>
              <span className="mc-ava-wrap">
                <span className="mc-ava">{(displayName || "?").charAt(0).toUpperCase()}</span>
                {isVerified && (
                  <span className="mc-mini-v"><McIcon name="verify" /></span>
                )}
              </span>
            </button>
            <button className="mc-who" onClick={(e) => { stop(e); onOpenProfile(owner); }}>
              <span className="mc-by-name">{displayName}</span>
              <span className="mc-who-sub">View profile <McIcon name="chev-r" /></span>
            </button>
          </>
        ) : (
          <span className="mc-by-name">{displayName}</span>
        )}
        {folder.university?.name && (
          <span className="mc-uni">
            <McIcon name="landmark" />
            <span>{folder.university.name}</span>
          </span>
        )}
        {onToggleBookmark && (
          <button
            className={`mc-bmk${isBookmarked ? " on" : ""}`}
            disabled={bookmarkBusy}
            title={isBookmarked ? "Remove from your space" : "Add to your space"}
            onClick={(e) => { e.stopPropagation(); if (!bookmarkBusy) onToggleBookmark(folder); }}
          >
            <McIcon name="bookmark" filled={isBookmarked} />
            <span>{Math.max(bookmarkCount, isBookmarked ? 1 : 0)}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default memo(CommunityFolderCard);
