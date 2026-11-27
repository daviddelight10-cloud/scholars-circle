// Scholar's golden orb — the app's AI mascot. Shared by the PDF reader chat,
// the global Scholar sheet, and any surface that speaks for the AI.
//
// `state` drives both motion AND expression — the orb has a face (glossy dark
// eyes + mouth inside the glass) and each mood changes it:
//   "thinking"  pulse + eyes glance up, flat mouth
//   "greeting"  entrance pop
//   "celebrate" spin + ^_^ eyes + open grin
//   "oops"      wobble + squinted worried eyes + wince
//   "excited"   bounce + wide eyes + grin
//   "sleepy"    dimmed settle + closed lids + tiny yawn
// Open eyes blink on a ~4.4s cycle — the small detail that reads "alive".
// One-shot states (greeting/celebrate/oops) replay by remounting or re-setting
// the state after clearing it.
//
// The orb is layered: deep gold marble base, a slowly-rotating iridescent
// sheen (oil-on-water shimmer — keeps the gold brand while catching the eye),
// a specular hotspot for a glass look, and the face on top.

let injected = false;
function ensureOrbStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.dataset.scOrbStyles = "1";
  el.textContent = `
@keyframes sc-orb-pulse { 0%,100% { transform: scale(1); filter: brightness(1); } 50% { transform: scale(1.12); filter: brightness(1.15); } }
@keyframes sc-orb-greet { 0% { transform: scale(0) rotate(-30deg); opacity: 0; } 55% { transform: scale(1.18) rotate(8deg); opacity: 1; } 75% { transform: scale(0.94) rotate(-4deg); } 100% { transform: scale(1) rotate(0); opacity: 1; } }
@keyframes sc-orb-celebrate { 0% { transform: scale(1) rotate(0); filter: brightness(1); } 30% { transform: scale(1.28) rotate(140deg); filter: brightness(1.55); } 60% { transform: scale(0.92) rotate(300deg); filter: brightness(1.2); } 100% { transform: scale(1) rotate(360deg); filter: brightness(1); } }
@keyframes sc-orb-oops { 0%,100% { transform: translateX(0) rotate(0); } 20% { transform: translateX(-14%) rotate(-12deg); } 45% { transform: translateX(12%) rotate(10deg); } 65% { transform: translateX(-8%) rotate(-7deg); } 85% { transform: translateX(5%) rotate(4deg); } }
@keyframes sc-orb-excited { 0%,100% { transform: translateY(0) scale(1); } 30% { transform: translateY(-16%) scale(1.05); } 55% { transform: translateY(0) scale(0.96); } 75% { transform: translateY(-8%) scale(1.02); } }
@keyframes sc-orb-sleepy { 0%,100% { transform: translateY(0) scale(0.94); filter: brightness(0.55) saturate(0.8); } 50% { transform: translateY(1.5px) scale(0.93); filter: brightness(0.62) saturate(0.8); } }
@keyframes sc-orb-sheen { to { transform: rotate(360deg); } }
@keyframes sc-orb-blink { 0%, 90%, 100% { transform: scaleY(1); } 94% { transform: scaleY(0.06); } }
.sc-orb-mood-thinking { animation: sc-orb-pulse 1.4s ease-in-out infinite; }
.sc-orb-mood-greeting { animation: sc-orb-greet 0.55s cubic-bezier(0.3,1.5,0.5,1) both; }
.sc-orb-mood-celebrate { animation: sc-orb-celebrate 0.9s cubic-bezier(0.34,1.4,0.5,1) 1; }
.sc-orb-mood-oops { animation: sc-orb-oops 0.55s ease-in-out 1; }
.sc-orb-mood-excited { animation: sc-orb-excited 0.7s ease-in-out infinite; }
.sc-orb-mood-sleepy { animation: sc-orb-sleepy 4.5s ease-in-out infinite; }
.sc-orb-sheen {
  position: absolute; inset: -35%; pointer-events: none;
  background: conic-gradient(from 0deg,
    transparent 0deg, rgba(130,205,255,0.4) 55deg, rgba(255,140,235,0.34) 135deg,
    rgba(150,255,175,0.32) 215deg, rgba(255,205,130,0.36) 295deg, transparent 360deg);
  animation: sc-orb-sheen 7.5s linear infinite;
  mix-blend-mode: screen;
}
.sc-orb-spec {
  position: absolute; top: 10%; left: 17%; width: 36%; height: 24%;
  border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, rgba(255,255,255,0.9), rgba(255,255,255,0));
}
`;
  document.head.appendChild(el);
}
ensureOrbStyles();

const MOOD_CLASS = {
  thinking: "sc-orb-mood-thinking",
  greeting: "sc-orb-mood-greeting",
  celebrate: "sc-orb-mood-celebrate",
  oops: "sc-orb-mood-oops",
  excited: "sc-orb-mood-excited",
  sleepy: "sc-orb-mood-sleepy",
};

// Face expressions per mood — eyes and mouth shapes drawn as divs, scaled off
// a 52px design unit so the face holds at any `size`.
const FACES = {
  idle:      { eye: "open",   mouth: "smile" },
  thinking:  { eye: "lookup", mouth: "flat"  },
  greeting:  { eye: "open",   mouth: "smile" },
  celebrate: { eye: "happy",  mouth: "grin"  },
  oops:      { eye: "squint", mouth: "wince" },
  excited:   { eye: "wide",   mouth: "grin"  },
  sleepy:    { eye: "closed", mouth: "yawn"  },
};

const INK = "#37260a";

function Eye({ kind, u, blink, flip }) {
  const w = 9.5 * u, h = 11.5 * u;
  if (kind === "happy") return (
    <span style={{ width: w * 1.1, height: h * 0.6, borderTop: `${Math.max(1.6, 2.4 * u)}px solid ${INK}`, borderRadius: "50%" }} />
  );
  if (kind === "closed") return (
    <span style={{ width: w * 1.1, height: h * 0.6, borderBottom: `${Math.max(1.6, 2.4 * u)}px solid ${INK}`, borderRadius: "50%" }} />
  );
  const extra =
    kind === "squint" ? `scaleY(0.55) rotate(${flip ? -9 : 9}deg)` :
    kind === "wide"   ? "scale(1.14)" :
    kind === "lookup" ? "scaleY(0.9) translateY(-14%)" : "";
  // Outer span carries the pose transform — the blink animates the inner eye's
  // own transform, so the pose survives the blink.
  return (
    <span style={{ display: "inline-flex", transform: extra || undefined }}>
      <span style={{
        width: w, height: h, borderRadius: "50%", position: "relative", flexShrink: 0,
        background: `radial-gradient(circle at 38% 30%, #7a5518, ${INK} 75%)`,
        animation: blink ? "sc-orb-blink 4.4s ease-in-out infinite" : undefined,
        animationDelay: blink && flip ? "0.06s" : undefined,
      }}>
        <span style={{
          position: "absolute", top: "17%", right: "15%", width: "27%", height: "24%",
          borderRadius: "50%", background: "rgba(255,255,255,0.9)",
        }} />
      </span>
    </span>
  );
}

function Mouth({ kind, u }) {
  const shape = {
    smile: { width: 15 * u, height: 8 * u, borderRadius: "10% 10% 50% 50% / 12% 12% 95% 95%", background: INK },
    grin:  { width: 15 * u, height: 10.5 * u, borderRadius: "22% 22% 55% 55% / 28% 28% 80% 80%", background: INK },
    flat:  { width: 11 * u, height: Math.max(1.6, 2.4 * u), borderRadius: 99, background: INK },
    wince: { width: 9 * u, height: Math.max(1.5, 2.2 * u), borderRadius: 99, background: INK, transform: "rotate(-7deg)" },
    yawn:  { width: 5 * u, height: 5.6 * u, borderRadius: "50%", background: INK },
  }[kind] || {};
  return <span style={{ display: "block", ...shape }} />;
}

export default function AiOrb({ size = 18, pulsing = false, state, style }) {
  const mood = MOOD_CLASS[state] || (pulsing ? MOOD_CLASS.thinking : "");
  const face = FACES[state] || FACES.idle;
  const u = size / 52;
  return (
    <div
      aria-hidden="true"
      className={mood || undefined}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        position: "relative",
        overflow: "hidden",
        background: "radial-gradient(circle at 30% 26%, #FFF3D0, #FFCA5F 30%, #F5A623 55%, #B06F0A 88%, #7A4D06 100%)",
        boxShadow:
          "inset 0 -3px 5px rgba(95,48,0,0.4), inset 0 1px 2px rgba(255,255,255,0.6), 0 0 10px rgba(245,166,35,0.5)",
        ...style,
      }}
    >
      <span className="sc-orb-sheen" />
      <span className="sc-orb-spec" />
      <span style={{
        position: "absolute", top: size * 0.30, left: 0, right: 0,
        display: "flex", justifyContent: "center", gap: 7 * u,
      }}>
        <Eye kind={face.eye} u={u} blink={face.eye === "open" || face.eye === "lookup"} />
        <Eye kind={face.eye} u={u} blink={face.eye === "open" || face.eye === "lookup"} flip />
      </span>
      <span style={{ position: "absolute", top: size * 0.60, left: 0, right: 0, display: "flex", justifyContent: "center" }}>
        <Mouth kind={face.mouth} u={u} />
      </span>
    </div>
  );
}
