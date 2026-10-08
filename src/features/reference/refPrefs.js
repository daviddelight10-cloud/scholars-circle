/**
 * Favorites + recents for reference tools — localStorage, scoped per user id
 * when available (falls back to a shared key so it still works logged out).
 */
const LS_PREFIX = "sc_ref";

function uid() {
  try {
    return JSON.parse(localStorage.getItem("sc_auth_user") || "{}")?.id || "anon";
  } catch {
    return "anon";
  }
}

function key(ns) {
  return `${LS_PREFIX}:${uid()}:${ns}`;
}

function read(ns) {
  try {
    const v = JSON.parse(localStorage.getItem(key(ns)) || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(ns, arr) {
  try {
    localStorage.setItem(key(ns), JSON.stringify(arr.slice(0, 60)));
  } catch {
    /* storage full/blocked — non-fatal */
  }
}

/** Toggle a favorite; returns the new fav list. */
export function toggleFav(ns, id) {
  const favs = read(`${ns}:fav`);
  const i = favs.indexOf(id);
  if (i >= 0) favs.splice(i, 1);
  else favs.unshift(id);
  write(`${ns}:fav`, favs);
  return favs;
}

export function getFavs(ns) {
  return read(`${ns}:fav`);
}

export function isFav(ns, id) {
  return read(`${ns}:fav`).includes(id);
}

/** Push an id to the front of the recents list (deduped). */
export function pushRecent(ns, id) {
  const rec = read(`${ns}:recent`).filter((x) => x !== id);
  rec.unshift(id);
  write(`${ns}:recent`, rec);
  return rec;
}

export function getRecents(ns) {
  return read(`${ns}:recent`);
}
