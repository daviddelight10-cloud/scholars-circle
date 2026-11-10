// Resolve a short diagram query to a Wikimedia Commons thumbnail, biased
// toward anatomical illustrations (Gray's Anatomy plates, labeled SVG
// diagrams) over photographs. Returns { src, href, title, license } or null.

const API = "https://commons.wikimedia.org/w/api.php";
const cache = new Map();

const DIAGRAM_WORDS = [
  "anatomy", "anatomical", "diagram", "illustration", "plate", "schematic",
  "labeled", "labelled", "drawing", "schema", "chart", "histology",
  "sagittal", "coronal", "cross-section", "axonometric", "gray",
];
const PHOTO_WORDS = [
  "photograph", "photo of", "selfie", "portrait", "cadaver", "autopsy",
  "surgery", "operation", "micrograph", "x-ray", "xray", "ct scan", "mri",
  "ultrasound", "endoscopy",
];

export async function fetchDiagram(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return null;
  if (cache.has(q)) return cache.get(q);

  const promise = (async () => {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: q,
      gsrnamespace: "6",
      gsrlimit: "10",
      prop: "imageinfo",
      iiprop: "url|size|mime|extmetadata",
      iiurlwidth: "640",
    });
    const res = await fetch(`${API}?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});

    const scored = [];
    for (const p of pages) {
      const ii = p.imageinfo?.[0];
      if (!ii?.thumburl || !ii?.descriptionurl) continue;
      const title = String(p.title || "");
      const desc = String(ii.extmetadata?.ImageDescription?.value || "").replace(/<[^>]+>/g, " ");
      const hay = `${title} ${desc}`.toLowerCase();
      let score = 0;
      for (const w of DIAGRAM_WORDS) if (hay.includes(w)) score += 2;
      if (/\.svg$/i.test(title)) score += 2;
      for (const w of PHOTO_WORDS) if (hay.includes(w)) score -= 3;
      // Wide banners / tall strips are rarely the illustration we want.
      if (ii.width && ii.height && (ii.width / ii.height > 3 || ii.height / ii.width > 3)) score -= 1;
      scored.push({
        score,
        src: ii.thumburl,
        href: ii.descriptionurl,
        title: title.replace(/^File:/i, ""),
        license: String(ii.extmetadata?.LicenseShortName?.value || ""),
      });
    }
    scored.sort((a, b) => b.score - a.score);
    const best = scored[0];
    return best && best.score > 0 ? best : null;
  })().catch(() => null);

  cache.set(q, promise);
  return promise;
}
