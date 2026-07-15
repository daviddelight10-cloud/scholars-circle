const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

export async function searchYouTube(query, { ngBoost = false } = {}) {
  const url = `${API_BASE}/youtube/search?q=${encodeURIComponent(query)}${ngBoost ? "&ng=1" : ""}`;
  const r = await fetch(url);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || `Search failed (${r.status})`);
  }
  const data = await r.json();
  return data.items || [];
}

export async function fetchTranscript(videoId, lang = "en") {
  const r = await fetch(`${API_BASE}/youtube/transcript/${videoId}?lang=${lang}`);
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err.detail || err.error || "Transcript unavailable");
  }
  const data = await r.json();
  return data.segments || [];
}

export async function fetchVideoDetails(videoId) {
  const r = await fetch(`${API_BASE}/youtube/details/${videoId}`);
  if (!r.ok) throw new Error("Details unavailable");
  return r.json();
}

// Find transcript segments around a timestamp (in seconds)
export function getTranscriptWindow(segments, timestampSec, windowSec = 30) {
  if (!segments?.length) return [];
  const start = Math.max(0, timestampSec - windowSec / 2);
  const end = timestampSec + windowSec / 2;
  return segments.filter((s) => s.start >= start && s.start <= end);
}

// Format seconds as MM:SS or HH:MM:SS
export function formatTime(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
