// Local-day helpers shared by the streak UI mirrors, survival quests and
// reminder scheduling. The server keeps the same notion of "day" via
// UserProgress.tzOffsetMinutes — so client-side day rollovers must use the
// device's LOCAL calendar, never toISOString() (which is always UTC and
// lands Lagos users an hour late).

export function localDayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Minutes EAST of UTC (e.g. +60 Lagos) — the inverse of getTimezoneOffset()
// which reports minutes to ADD to local time to reach UTC.
export function tzOffsetMinutes() {
  return -new Date().getTimezoneOffset();
}
