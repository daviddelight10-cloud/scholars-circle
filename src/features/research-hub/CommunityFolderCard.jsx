import { memo, useCallback } from "react";
import McIcon from "./McIcon.jsx";
import AvatarMark from "../../components/AvatarMark.jsx";
import { tileTintStyle } from "../../lib/researchUtils.js";

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
  isUserUni,
}) {
  const itemCount = folder._count?.resources ?? 0;
  const bookmarkCount = folder._count?.folderBookmarks ?? 0;
  const owner = folder.owner || {};
  const isLecturer = owner.role === "LECTURER" || owner.role === "TEACHER";
  const isVerified = isLecturer && (owner.lecturerProfile?.isVerified !== false);
  // Meaningful edge: blue = verified lecturer, gold = from your university
  const accent = isLecturer ? "acc-lec" : isUserUni ? "acc-uni" : "";
  const fresh = freshnessTag(folder);
  const displayName = owner.lecturerProfile?.fullName || owner.userProfile?.fullName || owner.username || "Unknown";

  const stop = useCallback((e) => e.stopPropagation(), []);

  return (
    <div className={`mc-c-card ${accent}`} onClick={onClick}>
      <div className="mc-c-top">
        <div className="mc-tile" style={tileTintStyle(folder.id || folder.name)}>
          <McIcon name="folder" />
        </div>
        <div className="mc-c-main">
          <div className="mc-c-titleline">
            {folder.visibility === "private" && (
              <McIcon name="lock" className="mc-c-lock" />
            )}
            <h3>{folder.name}</h3>
            {isVerified && (
              <span className="mc-vbadge" title="Verified lecturer">
                <McIcon name="verify" />
              </span>
            )}
            <span className="mc-c-count" title={`${itemCount} items`}>{itemCount}</span>
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

      {(isLecturer || folder.level || folder.semester || fresh) && (
        <div className="mc-c-tags">
          {isLecturer && (
            <span className="mc-tag lec"><McIcon name="verify" />Verified lecturer</span>
          )}
          {folder.level && <span className="mc-tag level">{folder.level}</span>}
          {folder.semester && <span className="mc-tag sem">{folder.semester}</span>}
          {fresh && <span className={`mc-tag ${fresh.cls}`}>{fresh.label}</span>}
        </div>
      )}

      <div className="mc-c-foot">
        {onOpenProfile ? (
          <>
            <button className="mc-ava-btn" onClick={(e) => { stop(e); onOpenProfile(owner); }} title={`View ${displayName}`}>
              <span className="mc-ava-wrap">
                {owner.avatar
                  ? <AvatarMark avatar={owner.avatar} name={displayName} size={26} className="mc-ava" style={{ background: "unset" }} />
                  : <span className="mc-ava">{(displayName || "?").charAt(0).toUpperCase()}</span>}
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
