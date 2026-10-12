// ── Character avatars ──────────────────────────────────────────────────────
// Stored as "char:<id>" in userProfile.avatar — a short key, no uploads, no
// network. Each entry is inner SVG markup for a 64×64 viewBox (the bg circle
// is included so a plain <svg> is all a renderer needs).
// Style: flat-realistic personas in the app's dark/gold palette + a few
// symbols for people who don't want a face.

const SKIN = { a: "#F2C9A4", b: "#E3AC7E", c: "#C98A5E", d: "#9C6644", e: "#7A4B2E" };
const SHADOW = "rgba(0,0,0,0.18)";

const FACE = {
  eyes: `<circle cx="24.5" cy="30" r="1.9" fill="#2B2118"/><circle cx="39.5" cy="30" r="1.9" fill="#2B2118"/>
    <circle cx="25.1" cy="29.4" r="0.65" fill="#fff"/><circle cx="40.1" cy="29.4" r="0.65" fill="#fff"/>`,
  smile: `<path d="M27.5 38.5 Q32 41.5 36.5 38.5" stroke="#8A4A38" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
  nose: `<path d="M31.4 32.5 Q30.6 35 31.8 35.8" stroke="rgba(0,0,0,0.22)" stroke-width="1.2" fill="none" stroke-linecap="round"/>`,
  blush: `<ellipse cx="21.5" cy="34.5" rx="2.6" ry="1.5" fill="rgba(230,120,100,0.35)"/><ellipse cx="42.5" cy="34.5" rx="2.6" ry="1.5" fill="rgba(230,120,100,0.35)"/>`,
  brows: `<path d="M21.5 25.5 Q24.5 24 27.5 25.5" stroke="#3D2C1E" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M36.5 25.5 Q39.5 24 42.5 25.5" stroke="#3D2C1E" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
};

const EARS = (s) => `<ellipse cx="14.5" cy="31" rx="3" ry="4" fill="${s}"/><ellipse cx="49.5" cy="31" rx="3" ry="4" fill="${s}"/>`;
const HEAD = (s) => `<ellipse cx="32" cy="31" rx="17.5" ry="19" fill="${s}"/>`;
const NECK = (s) => `<path d="M26 45 h12 v9 c0 2.5 -2.7 4 -6 4 s-6 -1.5 -6 -4 z" fill="${s}"/>`;
const SHOULDERS = (fill) => `<path d="M10 64 C10 52 20 47.5 32 47.5 C44 47.5 54 52 54 64 Z" fill="${fill}"/>`;
const STETHO = `<path d="M24 52 C24 58 27 62 32 62 C37 62 40 58 40 52" stroke="#2E2E38" stroke-width="2.2" fill="none" stroke-linecap="round"/>
  <circle cx="32" cy="60.5" r="2.6" fill="#B9BDC7" stroke="#2E2E38" stroke-width="1.4"/>`;
const GLASSES = `<g stroke="#2B2118" stroke-width="1.6" fill="rgba(255,255,255,0.10)">
    <rect x="19" y="26.5" width="11" height="8" rx="3"/><rect x="34" y="26.5" width="11" height="8" rx="3"/>
    <path d="M30 30.5 h4 M19 30 h-4.5 M45 30 h4.5"/></g>`;

const wrap = (bg, body) => `<circle cx="32" cy="32" r="32" fill="${bg}"/>${body}`;

export const AVATARS = [
  /* ─── Faces ─── */
  {
    id: "doc-f", label: "Medic — F", svg: wrap("#1E4D5C",
      `${SHOULDERS("#F4F4F2")}${SHOULDERS("rgba(45,155,168,0.0)")}
       <path d="M10 64 C10 53 19 48.5 27 47.8 L32 53.5 L37 47.8 C45 48.5 54 53 54 64 Z" fill="#F4F4F2"/>
       <path d="M27 47.8 L32 53.5 L37 47.8 L34.5 52.5 L32 54.5 L29.5 52.5 Z" fill="#2D9BA8"/>
       ${NECK(SKIN.b)}${HEAD(SKIN.b)}${EARS(SKIN.b)}
       <path d="M14.5 27 C14 16 22 11 32 11 C42 11 50 16 49.5 27 C47 20 43.5 17 32 17 C20.5 17 17 20 14.5 27 Z" fill="#4A3226"/>
       <path d="M49.5 27 C50 33 48 39 44 42 L43 34 Z" fill="#4A3226"/>
       <path d="M14.5 27 C14 33 16 39 20 42 L21 34 Z" fill="#4A3226"/>
       <ellipse cx="32" cy="12.5" rx="7.5" ry="5.5" fill="#4A3226"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}${FACE.smile}${FACE.blush}${STETHO}`),
  },
  {
    id: "doc-m", label: "Medic — M", svg: wrap("#3A2A55",
      `<path d="M10 64 C10 53 19 48.5 27 47.8 L32 53.5 L37 47.8 C45 48.5 54 53 54 64 Z" fill="#F4F4F2"/>
       <path d="M27 47.8 L32 53.5 L37 47.8 L34.5 52.5 L32 54.5 L29.5 52.5 Z" fill="#4C7EC1"/>
       ${NECK(SKIN.d)}${HEAD(SKIN.d)}${EARS(SKIN.d)}
       <path d="M14.5 27 C14 17 22 12 32 12 C42 12 50 17 49.5 27 C47 20.5 43 18 32 18 C21 18 17 20.5 14.5 27 Z" fill="#241610"/>
       <path d="M24 41 Q32 47 40 41 Q39 46 32 46.5 Q25 46 24 41 Z" fill="#241610" opacity="0.9"/>
       <path d="M24.5 39.5 Q32 45.5 39.5 39.5" stroke="#241610" stroke-width="1.4" fill="none" stroke-linecap="round"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}
       <path d="M28 38.8 Q32 40.6 36 38.8" stroke="#6B3B2E" stroke-width="1.6" fill="none" stroke-linecap="round"/>
       ${STETHO}`),
  },
  {
    id: "surgeon", label: "Surgeon", svg: wrap("#174A44",
      `${SHOULDERS("#2D9BA8")}
       <path d="M10 64 C10 53 19 48.5 27 47.8 L32 53 L37 47.8 C45 48.5 54 53 54 64 Z" fill="#2D9BA8"/>
       ${NECK(SKIN.c)}${HEAD(SKIN.c)}${EARS(SKIN.c)}
       <path d="M14.5 24 C15 15 23 11 32 11 C41 11 49 15 49.5 24 L49.5 26.5 L14.5 26.5 Z" fill="#35B8C6"/>
       <rect x="13.5" y="24.5" width="37" height="3.5" rx="1.75" fill="#23909C"/>
       <path d="M19 33.5 C19 31 26 30 32 30 C38 30 45 31 45 33.5 L45 42 C45 45 39 47.5 32 47.5 C25 47.5 19 45 19 42 Z" fill="#E9F2F4"/>
       <path d="M19 36.5 Q32 40 45 36.5" stroke="#C4D6DB" stroke-width="1" fill="none"/>
       ${FACE.brows}${FACE.eyes}
       <path d="M24.5 34 Q32 36.5 39.5 34" stroke="#B9CBD2" stroke-width="1" fill="none" stroke-dasharray="2 2"/>`),
  },
  {
    id: "nurse", label: "Nurse", svg: wrap("#4A2E3D",
      `<path d="M10 64 C10 53 19 48.5 27 47.8 L32 53 L37 47.8 C45 48.5 54 53 54 64 Z" fill="#E88BA0"/>
       <path d="M28.5 49.5 L32 51.5 L35.5 49.5" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>
       ${NECK(SKIN.a)}${HEAD(SKIN.a)}${EARS(SKIN.a)}
       <path d="M14.5 27 C14 16 22 11.5 32 11.5 C42 11.5 50 16 49.5 27 C47.5 20 44 18 32 18 C20 18 16.5 20 14.5 27 Z" fill="#7A4A22"/>
       <circle cx="32" cy="10.5" r="6" fill="#7A4A22"/>
       <path d="M14.8 28 Q14 36 19.5 40 L20.5 33 Z" fill="#7A4A22"/>
       <path d="M49.2 28 Q50 36 44.5 40 L43.5 33 Z" fill="#7A4A22"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}${FACE.smile}${FACE.blush}${STETHO}`),
  },
  {
    id: "nerd", label: "Bookworm", svg: wrap("#2C3B57",
      `${SHOULDERS("#6B5CA8")}
       <path d="M27 48.5 L32 51 L37 48.5" stroke="#fff" stroke-width="1.6" fill="none"/>
       ${NECK(SKIN.a)}${HEAD(SKIN.a)}${EARS(SKIN.a)}
       <path d="M15 26 C13 13 22 8.5 32 8.5 C42 8.5 51 13 49 26 C47.5 20 45 17 32 17 C19 17 16.5 20 15 26 Z" fill="#33241A"/>
       <circle cx="18" cy="15" r="4.5" fill="#33241A"/><circle cx="25" cy="11" r="4.5" fill="#33241A"/>
       <circle cx="33" cy="9.5" r="4.5" fill="#33241A"/><circle cx="41" cy="11" r="4.5" fill="#33241A"/><circle cx="47" cy="15" r="4.5" fill="#33241A"/>
       ${FACE.brows}${GLASSES}${FACE.eyes}${FACE.nose}
       <path d="M27.5 38.5 Q32 41.5 36.5 38.5" stroke="#8A4A38" stroke-width="1.7" fill="none" stroke-linecap="round"/>`),
  },
  {
    id: "hoodie", label: "Night Owl", svg: wrap("#26333F",
      `<path d="M11 64 C11 52 20 47 32 47 C44 47 53 52 53 64 Z" fill="#5B7285"/>
       <path d="M15 52 Q32 42 49 52" stroke="#46606F" stroke-width="3.5" fill="none" stroke-linecap="round"/>
       ${NECK(SKIN.e)}${HEAD(SKIN.e)}${EARS(SKIN.e)}
       <path d="M14.5 27 C14 17 22 12.5 32 12.5 C42 12.5 50 17 49.5 27 C47.5 20.5 44 18.5 32 18.5 C20 18.5 16.5 20.5 14.5 27 Z" fill="#191008"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}
       <path d="M27.5 39 Q32 40.8 36.5 39" stroke="#5A3B2E" stroke-width="1.7" fill="none" stroke-linecap="round"/>
       <rect x="12" y="28" width="3" height="8" rx="1.5" fill="#DADFE8"/>
       <rect x="49" y="28" width="3" height="8" rx="1.5" fill="#DADFE8"/>`),
  },
  {
    id: "afro", label: "Afro", svg: wrap("#4A3B22",
      `${SHOULDERS("#D9822B")}
       <path d="M27 48.5 L32 51 L37 48.5" stroke="#8A4B12" stroke-width="1.6" fill="none"/>
       ${NECK(SKIN.d)}${HEAD(SKIN.d)}${EARS(SKIN.d)}
       <circle cx="32" cy="14.5" r="13" fill="#241610"/>
       <circle cx="20" cy="18" r="7" fill="#241610"/><circle cx="44" cy="18" r="7" fill="#241610"/>
       <circle cx="15" cy="24" r="5.5" fill="#241610"/><circle cx="49" cy="24" r="5.5" fill="#241610"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}${FACE.smile}
       <circle cx="14" cy="33" r="1.8" fill="#F0C65C"/><circle cx="50" cy="33" r="1.8" fill="#F0C65C"/>`),
  },
  {
    id: "hijabi", label: "Hijabi", svg: wrap("#374A33",
      `<path d="M10 64 C10 52 20 46.5 32 46.5 C44 46.5 54 52 54 64 Z" fill="#5E7A5A"/>
       <path d="M13.5 42 C11 26 18 11 32 11 C46 11 53 26 50.5 42 L50.5 64 L45 64 L45 46 C45 46 44 44 42.5 44 L21.5 44 C20 44 19 46 19 46 L19 64 L13.5 64 Z" fill="#88A284"/>
       <ellipse cx="32" cy="32" rx="14.5" ry="15.5" fill="${SKIN.b}"/>
       <path d="M17.5 30 C17.5 21 23 15.5 32 15.5 C41 15.5 46.5 21 46.5 30 C44 23 41 19.5 32 19.5 C23 19.5 20 23 17.5 30 Z" fill="#88A284"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}${FACE.smile}${FACE.blush}`),
  },
  {
    id: "braids", label: "Braids", svg: wrap("#3F2F52",
      `${SHOULDERS("#E0B64C")}
       <path d="M27 48.5 L32 51 L37 48.5" stroke="#8A6B20" stroke-width="1.6" fill="none"/>
       ${NECK(SKIN.d)}${HEAD(SKIN.d)}${EARS(SKIN.d)}
       <path d="M14.5 27 C14 16.5 22 11.5 32 11.5 C42 11.5 50 16.5 49.5 27 C47.5 20 44 17.5 32 17.5 C20 17.5 16.5 20 14.5 27 Z" fill="#1C1109"/>
       ${[17.5, 22.5, 27.5, 36.5, 41.5, 46.5].map(x => `<path d="M${x} 22 C${x - 1.5} 30 ${x - 1} 40 ${x - 2} 48" stroke="#1C1109" stroke-width="2.6" fill="none" stroke-linecap="round"/>`).join("")}
       <circle cx="15.5" cy="47" r="1.6" fill="#E0B64C"/><circle cx="20.5" cy="47" r="1.6" fill="#E0B64C"/>
       <circle cx="25.5" cy="47" r="1.6" fill="#E0B64C"/><circle cx="34.5" cy="47" r="1.6" fill="#E0B64C"/>
       <circle cx="39.5" cy="47" r="1.6" fill="#E0B64C"/><circle cx="44.5" cy="47" r="1.6" fill="#E0B64C"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}${FACE.smile}`),
  },
  {
    id: "dj", label: "Headphones", svg: wrap("#232F4A",
      `${SHOULDERS("#3D5A80")}
       <path d="M27 48.5 L32 51 L37 48.5" stroke="#22344E" stroke-width="1.6" fill="none"/>
       ${NECK(SKIN.c)}${HEAD(SKIN.c)}${EARS(SKIN.c)}
       <path d="M14.5 27 C14 17 22 12 32 12 C42 12 50 17 49.5 27 C47.5 20.5 43.5 18 32 18 C20.5 18 16.5 20.5 14.5 27 Z" fill="#2E1F16"/>
       <path d="M12 30 C12 17 20 9 32 9 C44 9 52 17 52 30" stroke="#F0C65C" stroke-width="3.2" fill="none" stroke-linecap="round"/>
       <rect x="9.5" y="27" width="7" height="12" rx="3.2" fill="#F0C65C"/>
       <rect x="47.5" y="27" width="7" height="12" rx="3.2" fill="#F0C65C"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}${FACE.smile}`),
  },
  {
    id: "prof", label: "Professor", svg: wrap("#3A3430",
      `${SHOULDERS("#6B5B4A")}
       <path d="M26 48.5 L32 53 L38 48.5" stroke="#4A3B2E" stroke-width="1.6" fill="none"/>
       ${NECK(SKIN.b)}${HEAD(SKIN.b)}${EARS(SKIN.b)}
       <path d="M15.5 26 C16 17 23 12.5 32 12.5 C41 12.5 48 17 48.5 26 C46 19 42 17 32 17 C22 17 18 19 15.5 26 Z" fill="#B9B3AC"/>
       <path d="M14 26.5 L17 40 L20 34 L19.5 26 Z" fill="#B9B3AC"/>
       <path d="M50 26.5 L47 40 L44 34 L44.5 26 Z" fill="#B9B3AC"/>
       <path d="M23 40 Q32 48 41 40 Q40 46.5 32 47 Q24 46.5 23 40 Z" fill="#B9B3AC"/>
       <path d="M20 25 Q24.5 23.5 28 25.2" stroke="#8B857E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
       <path d="M36 25.2 Q39.5 23.5 44 25" stroke="#8B857E" stroke-width="1.8" fill="none" stroke-linecap="round"/>
       ${GLASSES}${FACE.eyes}${FACE.nose}
       <path d="M27.5 39.5 Q32 41.5 36.5 39.5" stroke="#8A4A38" stroke-width="1.7" fill="none" stroke-linecap="round"/>`),
  },
  {
    id: "bob", label: "Bob", svg: wrap("#512F3A",
      `${SHOULDERS("#C25E7E")}
       <path d="M27 48.5 L32 51 L37 48.5" stroke="#8A3050" stroke-width="1.6" fill="none"/>
       ${NECK(SKIN.a)}${HEAD(SKIN.a)}${EARS(SKIN.a)}
       <path d="M14 29 C13 16 22 10.5 32 10.5 C42 10.5 51 16 50 29 L48.5 38 C46.5 34 46 28 45.5 24 L18.5 24 C18 28 17.5 34 15.5 38 Z" fill="#3A2417"/>
       <path d="M18.5 24 C18 20 22 17.5 32 17.5 C42 17.5 46 20 45.5 24 Z" fill="#3A2417"/>
       ${FACE.brows}${FACE.eyes}${FACE.nose}${FACE.smile}${FACE.blush}
       <circle cx="15" cy="36" r="1.6" fill="#F0C65C"/><circle cx="49" cy="36" r="1.6" fill="#F0C65C"/>`),
  },
  /* ─── Symbols ─── */
  {
    id: "heart", label: "Heart", svg: wrap("#4A2028",
      `<path d="M32 50 C20 42 14 33 17 25 C19.5 18.5 27 17 32 23 C37 17 44.5 18.5 47 25 C50 33 44 42 32 50 Z" fill="#E8555E"/>
       <path d="M23 22 C25.5 16.5 30 15.5 33 19" stroke="#E8555E" stroke-width="3" fill="none" stroke-linecap="round"/>
       <path d="M17 30 C16 24 20 19.5 25 19.5" stroke="#F08A90" stroke-width="2" fill="none" stroke-linecap="round"/>
       <path d="M28 15.5 C29.5 12.5 33 11.5 35.5 13" stroke="#C43B45" stroke-width="2.5" fill="none" stroke-linecap="round"/>
       <path d="M39 20.5 C42 20 44.5 22.5 44 26" stroke="#F08A90" stroke-width="1.8" fill="none" stroke-linecap="round"/>
       <path d="M25 30 h4 l2 -4 l3 7 l2 -3 h4" stroke="#7A1E26" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  },
  {
    id: "brain", label: "Brain", svg: wrap("#3A2440",
      `<g stroke="#E8A9C9" stroke-width="4.5" fill="none" stroke-linecap="round">
        <path d="M30 14 C22 14 16 20 16 28 C16 30 16.5 32 17 33.5 C13 35 11 39 12 43 C13 48 18 51 23 50 C24 52 27 53 30 53 Z"/>
      </g>
      <g stroke="#E8A9C9" stroke-width="4.5" fill="none" stroke-linecap="round">
        <path d="M34 14 C42 14 48 20 48 28 C48 30 47.5 32 47 33.5 C51 35 53 39 52 43 C51 48 46 51 41 50 C40 52 37 53 34 53 Z"/>
      </g>
      <path d="M32 14 L32 53" stroke="#C77BA5" stroke-width="2.5" stroke-linecap="round"/>
      <g stroke="#C77BA5" stroke-width="1.6" fill="none" stroke-linecap="round">
        <path d="M22 24 Q26 22 27 26"/><path d="M20 34 Q24 33 25 37"/><path d="M42 24 Q38 22 37 26"/><path d="M44 34 Q40 33 39 37"/>
      </g>`),
  },
  {
    id: "pill", label: "Capsule", svg: wrap("#1F3A2E",
      `<g transform="rotate(-35 32 34)">
        <rect x="14" y="27" width="36" height="14" rx="7" fill="#F0F2F6"/>
        <path d="M32 27 h11 a7 7 0 0 1 0 14 h-11 z" fill="#4CC08A"/>
        <rect x="30.9" y="27" width="2.2" height="14" fill="#D5DAE4"/>
        <ellipse cx="24" cy="30.5" rx="4.5" ry="1.8" fill="#fff" opacity="0.85"/>
      </g>
      <path d="M47 18 l1.2 3 3 1.2 -3 1.2 -1.2 3 -1.2 -3 -3 -1.2 3 -1.2 Z" fill="#F0C65C"/>
      <path d="M17 16 l0.9 2.2 2.2 0.9 -2.2 0.9 -0.9 2.2 -0.9 -2.2 -2.2 -0.9 2.2 -0.9 Z" fill="#F0C65C" opacity="0.8"/>`),
  },
  {
    id: "helix", label: "Helix", svg: wrap("#1E3350",
      `<g fill="none" stroke-linecap="round">
        <path d="M24 12 C24 22 40 26 40 34 C40 42 24 44 24 52" stroke="#6FB5F0" stroke-width="3.4"/>
        <path d="M40 12 C40 22 24 26 24 34 C24 42 40 44 40 52" stroke="#4CC0A8" stroke-width="3.4"/>
        <path d="M27 17 h10 M25 23 h14 M26 30 h12 M26 38 h12 M27 45 h10 M28 50 h8" stroke="#9DB8D8" stroke-width="2.2"/>
      </g>`),
  },
];

const BY_ID = new Map(AVATARS.map((a) => [a.id, a]));

export function findAvatar(id) {
  return BY_ID.get(id) || null;
}

// "char:doc-f" -> "doc-f" | anything else -> null
export function avatarKeyOf(src) {
  return typeof src === "string" && src.startsWith("char:") ? src.slice(5) : null;
}

export function isCharAvatar(src) {
  return avatarKeyOf(src) != null && !!findAvatar(avatarKeyOf(src));
}

// Deterministic default so a skipped pick still yields a consistent look.
export function defaultAvatarFor(seed = "") {
  const s = String(seed || "scholar");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `char:${AVATARS[Math.abs(h) % AVATARS.length].id}`;
}
