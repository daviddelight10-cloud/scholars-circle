import { prisma } from "../db.js";

// Which review items belong to the user's "My Space":
//  - owned resources, unless their folder is archived or soft-deleted
//  - bookmarked resources, unless their bookmark folder is archived/deleted
//  - resources inside folders the user saved (FolderBookmark)
// Anything else — never-saved community materials, deleted folders — is
// excluded from Home, Daily Review, stats and folder chips.
export async function loadReviewScope(userId) {
  const [archived, deletedOwn, saved] = await Promise.all([
    prisma.userArchivedFolder.findMany({ where: { userId }, select: { folderId: true } }).catch(() => []),
    prisma.folder.findMany({ where: { ownerId: userId, deletedAt: { not: null } }, select: { id: true } }).catch(() => []),
    prisma.folderBookmark.findMany({ where: { userId }, select: { folderId: true } }).catch(() => []),
  ]);
  const hiddenFolderIds = new Set([...archived.map((a) => a.folderId), ...deletedOwn.map((f) => f.id)]);
  const savedIds = saved.map((s) => s.folderId).filter((id) => !hiddenFolderIds.has(id));
  const savedActive = savedIds.length
    ? (await prisma.folder.findMany({ where: { id: { in: savedIds }, deletedAt: null }, select: { id: true } }).catch(() => savedIds.map((id) => ({ id })))).map((f) => f.id)
    : [];
  return { hiddenFolderIds, savedFolderIds: new Set(savedActive) };
}

// Folder bucket for a review item, or null when the item is not in My Space.
// Callers must include on item.resource: uploadedBy, folderId,
// folder { id, name, courseCode?, deletedAt }, and bookmarks (filtered to the
// user) { folderId, folder { id, name, courseCode?, deletedAt } }.
export function reviewFolderOf(item, userId, scope) {
  const owned = item.resource?.uploadedBy === userId;
  const bookmark = item.resource?.bookmarks?.[0];
  let folderId, folder, emptyKey, emptyName;
  if (owned) {
    folderId = item.resource?.folderId || null;
    folder = item.resource?.folder;
    emptyKey = "__unfiled__"; emptyName = "Unfiled";
  } else if (bookmark) {
    folderId = bookmark.folderId || null;
    folder = bookmark.folder;
    emptyKey = "__community__"; emptyName = "Community";
  } else if (item.resource?.folderId && scope?.savedFolderIds?.has(item.resource.folderId)) {
    folderId = item.resource.folderId;
    folder = item.resource?.folder;
    emptyKey = "__community__"; emptyName = "Community";
  } else {
    return null;
  }
  if (folder?.deletedAt) return null;
  if (folderId && scope?.hiddenFolderIds?.has(folderId)) return null;
  return {
    key: folderId || emptyKey,
    folderId,
    folderName: folder?.name || emptyName,
    courseCode: folder?.courseCode || null,
  };
}
