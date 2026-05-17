import express from "express";

const router = express.Router();

const YT_API_KEY = process.env.YOUTUBE_API_KEY || "";

// Simple in-memory caches (reset on server restart)
const searchCache = new Map();
const transcriptCache = new Map();
const detailsCache = new Map();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min

function cacheGet(map, key) {
  const entry = map.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return entry.v;
}
function cacheSet(map, key, v) {
  map.set(key, { v, t: Date.now() });
}

// ─── Search via official YouTube Data API ────────────────────────────────────
async function searchOfficial(q) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=10&safeSearch=strict&videoEmbeddable=true&q=${encodeURIComponent(q)}&key=${YT_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`YouTube API error ${r.status}: ${text.slice(0, 120)}`);
  }
  const json = await r.json();
  const items = (json.items || []).map((it) => ({
    videoId: it.id?.videoId,
    title: it.snippet?.title,
    description: it.snippet?.description,
    channelTitle: it.snippet?.channelTitle,
    channelId: it.snippet?.channelId,
    thumbnail: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url,
    publishedAt: it.snippet?.publishedAt,
  }));
  return items.filter((i) => i.videoId);
}

// ─── Search via no-key fallback (scrape YouTube search page) ─────────────────
// Note: This is best-effort; YouTube can change markup at any time. Use API key in prod.
async function searchNoKey(q) {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAQ%253D%253D`; // sp = videos only
  const r = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!r.ok) throw new Error(`Fallback search failed: ${r.status}`);
  const html = await r.text();
  // Locate the JSON blob
  const m = html.match(/var ytInitialData\s*=\s*(\{[\s\S]*?\});\s*<\/script>/);
  if (!m) throw new Error("Could not parse YouTube search page");
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    throw new Error("Could not parse YouTube JSON");
  }
  const items = [];
  try {
    const sections =
      data.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents || [];
    for (const sec of sections) {
      const list = sec.itemSectionRenderer?.contents || [];
      for (const item of list) {
        const v = item.videoRenderer;
        if (!v) continue;
        items.push({
          videoId: v.videoId,
          title: v.title?.runs?.[0]?.text || "",
          description:
            v.detailedMetadataSnippets?.[0]?.snippetText?.runs
              ?.map((r) => r.text)
              .join("") || "",
          channelTitle: v.ownerText?.runs?.[0]?.text || v.longBylineText?.runs?.[0]?.text || "",
          channelId:
            v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || "",
          thumbnail: v.thumbnail?.thumbnails?.slice(-1)[0]?.url || "",
          duration: v.lengthText?.simpleText || "",
          views: v.viewCountText?.simpleText || "",
          publishedAt: v.publishedTimeText?.simpleText || "",
        });
        if (items.length >= 10) break;
      }
      if (items.length >= 10) break;
    }
  } catch (e) {
    throw new Error("Failed to extract search results");
  }
  return items;
}

// ─── GET /youtube/search ─────────────────────────────────────────────────────
router.get("/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q) return res.status(400).json({ error: "Missing query" });

  // Nigerian-context boost (optional flag)
  const ngBoost = req.query.ng === "1" ? " Nigerian university tutorial" : "";
  const searchTerm = q + ngBoost;

  const cacheKey = searchTerm.toLowerCase();
  const cached = cacheGet(searchCache, cacheKey);
  if (cached) return res.json({ items: cached, cached: true });

  try {
    let items;
    if (YT_API_KEY) {
      try {
        items = await searchOfficial(searchTerm);
      } catch (e) {
        console.warn("YouTube official search failed, falling back:", e.message);
        items = await searchNoKey(searchTerm);
      }
    } else {
      items = await searchNoKey(searchTerm);
    }
    cacheSet(searchCache, cacheKey, items);
    res.json({ items, cached: false });
  } catch (err) {
    console.error("YouTube search error:", err.message);
    res.status(502).json({ error: "Search failed", detail: err.message });
  }
});

// ─── Transcript fetch via YouTube timedtext endpoint ─────────────────────────
async function fetchTranscript(videoId, lang = "en") {
  // Step 1: Get video page to extract caption tracks
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const r = await fetch(videoUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
  if (!r.ok) throw new Error(`Cannot load video page: ${r.status}`);
  const html = await r.text();

  // Find captionTracks JSON
  const m = html.match(/"captionTracks":\s*(\[[^\]]+\])/);
  if (!m) throw new Error("No captions available for this video");
  let tracks;
  try {
    tracks = JSON.parse(m[1]);
  } catch {
    throw new Error("Could not parse caption tracks");
  }

  // Pick best track: requested lang > auto-generated en > first
  let track =
    tracks.find((t) => t.languageCode === lang && !t.kind) ||
    tracks.find((t) => t.languageCode === lang) ||
    tracks.find((t) => t.languageCode?.startsWith("en")) ||
    tracks[0];
  if (!track || !track.baseUrl) throw new Error("No usable caption track");

  // Get JSON3 format
  const jsonUrl = track.baseUrl + "&fmt=json3";
  const tr = await fetch(jsonUrl);
  if (!tr.ok) throw new Error(`Caption fetch failed: ${tr.status}`);
  const data = await tr.json();
  const segments = (data.events || [])
    .filter((e) => e.segs)
    .map((e) => ({
      start: (e.tStartMs || 0) / 1000,
      duration: (e.dDurationMs || 0) / 1000,
      text: e.segs
        .map((s) => s.utf8 || "")
        .join("")
        .replace(/\n/g, " ")
        .trim(),
    }))
    .filter((s) => s.text);

  return segments;
}

router.get("/transcript/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !/^[\w-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid videoId" });
  }
  const cached = cacheGet(transcriptCache, videoId);
  if (cached) return res.json({ segments: cached, cached: true });
  try {
    const segments = await fetchTranscript(videoId, req.query.lang || "en");
    cacheSet(transcriptCache, videoId, segments);
    res.json({ segments, cached: false });
  } catch (err) {
    console.warn(`Transcript ${videoId} failed:`, err.message);
    res.status(404).json({ error: "Transcript unavailable", detail: err.message });
  }
});

// ─── Video details ───────────────────────────────────────────────────────────
router.get("/details/:videoId", async (req, res) => {
  const { videoId } = req.params;
  if (!/^[\w-]{11}$/.test(videoId)) {
    return res.status(400).json({ error: "Invalid videoId" });
  }
  const cached = cacheGet(detailsCache, videoId);
  if (cached) return res.json(cached);

  if (!YT_API_KEY) {
    return res.json({ videoId, note: "Details require YOUTUBE_API_KEY" });
  }
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${YT_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Details API ${r.status}`);
    const json = await r.json();
    const item = json.items?.[0];
    if (!item) return res.status(404).json({ error: "Not found" });
    const out = {
      videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      channelTitle: item.snippet.channelTitle,
      tags: item.snippet.tags || [],
      duration: item.contentDetails.duration,
      thumbnail:
        item.snippet.thumbnails.maxres?.url ||
        item.snippet.thumbnails.high?.url ||
        item.snippet.thumbnails.medium?.url,
    };
    cacheSet(detailsCache, videoId, out);
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
