// Shared group avatar helpers (were copy-pasted in GroupsTab/GroupView/ClanBattles).
export function initials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

// Deterministic gradient from the group name — every group gets its own hue.
export function groupGradient(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, hsl(${h} 65% 45%), hsl(${(h + 40) % 360} 70% 32%))`;
}
