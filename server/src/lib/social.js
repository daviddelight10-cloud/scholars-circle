// Shared public-user serialization for social surfaces (feed, messages, groups).

export const AUTHOR_SELECT = {
  id: true,
  username: true,
  fullName: true,
  role: true,
  userProfile: {
    select: {
      avatar: true,
      level: true,
      department: true,
      universityId: true,
      university: { select: { name: true } },
    },
  },
};

export function publicUser(u) {
  if (!u) return null;
  const p = u.userProfile || {};
  return {
    id: u.id,
    name: u.fullName || u.username || "Scholar",
    handle: u.username ? `@${u.username}` : null,
    role: u.role,
    avatar: p.avatar || null,
    level: p.level || null,
    department: p.department || null,
    uni: p.university?.name || null,
  };
}
