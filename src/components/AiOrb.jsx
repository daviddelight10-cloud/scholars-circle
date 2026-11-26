// Scholar's golden orb — the app's AI mascot. Shared by the PDF reader chat,
// the global Scholar sheet, and any surface that speaks for the AI.
//
// `state` is the mascot's motion vocabulary — an abstract orb can't pull a
// face, so its emotion IS animation:
//   "thinking"  scale+brightness pulse (same as legacy `pulsing`)
//   "greeting"  entrance pop when it first appears
//   "celebrate" spin + flash on a win (correct answer, streak save)
//   "oops"      sympathetic wobble on a wrong answer / error
//   "excited"   attention bounce when it wants to be tapped
//   "sleepy"    dimmed slow settle when idle
// One-shot states (greeting/celebrate/oops) replay by remounting or re-setting
// the state after clearing it.
//
// The orb is layered: deep gold marble base, a slowly-rotating iridescent
// sheen (oil-on-water shimmer — keeps the gold brand while catching the eye),
// and a specular hotspot for a glass look.

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

export default function AiOrb({ size = 18, pulsing = false, state, style }) {
  const mood = MOOD_CLASS[state] || (pulsing ? MOOD_CLASS.thinking : "");
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
    </div>
  );
}
