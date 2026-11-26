// Celebration — full-screen confetti cannon + rank-up banner.
// Zero dependencies: a 60fps canvas particle system with two corner cannons
// and a gentle rain, fired when the user climbs the leaderboard.
import { useEffect, useRef } from "react";

const COLORS = ["#F5A623", "#FFD166", "#3DD68C", "#4F8EF7", "#FF6B9D", "#FFFFFF", "#B78CFF"];

function runConfetti(canvas, onDone) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = innerWidth, H = innerHeight;

  const parts = [];
  const spawn = (x, y, vx, vy) => ({
    x, y, vx, vy,
    w: 5 + Math.random() * 6,
    h: 7 + Math.random() * 9,
    rot: Math.random() * Math.PI * 2,
    vr: (Math.random() - 0.5) * 0.3,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    shape: Math.random() < 0.25 ? "circle" : Math.random() < 0.35 ? "streamer" : "rect",
    flut: Math.random() * Math.PI * 2,
    flutV: 0.04 + Math.random() * 0.08,
    life: 1,
    decay: 0.004 + Math.random() * 0.004,
  });

  // Two corner cannons angled inward + a soft rain from the top.
  for (let i = 0; i < 80; i++) {
    const a = (-55 - Math.random() * 50) * Math.PI / 180; // up-right from bottom-left
    const sp = 14 + Math.random() * 10;
    parts.push(spawn(-10, H + 10, Math.cos(a) * sp * -1, Math.sin(a) * sp));
  }
  for (let i = 0; i < 80; i++) {
    const a = (235 + Math.random() * 50) * Math.PI / 180; // up-left from bottom-right
    const sp = 14 + Math.random() * 10;
    parts.push(spawn(W + 10, H + 10, Math.cos(a) * sp, Math.sin(a) * sp));
  }
  for (let i = 0; i < 60; i++) {
    parts.push(spawn(Math.random() * W, -20 - Math.random() * H * 0.3, (Math.random() - 0.5) * 1.5, 2 + Math.random() * 2));
  }

  let raf;
  const tick = () => {
    ctx.clearRect(0, 0, W, H);
    let alive = 0;
    for (const p of parts) {
      if (p.life <= 0) continue;
      alive++;
      p.flut += p.flutV;
      p.vy += 0.22;            // gravity
      p.vx *= 0.985;           // drag
      p.vy *= 0.992;
      p.x += p.vx + Math.sin(p.flut) * 1.6; // flutter
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > H * 0.55) p.life -= p.decay;
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === "circle") {
        ctx.beginPath(); ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2); ctx.fill();
      } else if (p.shape === "streamer") {
        ctx.fillRect(-p.w / 2, -p.h, p.w * 0.5, p.h * 2);
      } else {
        // classic confetti rect with a little 3D flip via scaleY wobble
        ctx.scale(1, Math.abs(Math.sin(p.flut)) * 0.7 + 0.3);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      }
      ctx.restore();
    }
    if (alive > 0) raf = requestAnimationFrame(tick);
    else onDone?.();
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

// ConfettiBurst — the cannon/rain without the rank banner, for wins that
// aren't leaderboard climbs (e.g. acing a chapter review).
export function ConfettiBurst({ onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const stop = canvasRef.current ? runConfetti(canvasRef.current) : null;
    const t = setTimeout(() => onDone?.(), 4200);
    return () => { stop?.(); clearTimeout(t); };
  }, [onDone]);
  return (
    <canvas
      ref={canvasRef}
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 9998, pointerEvents: "none" }}
    />
  );
}

export default function Celebration({ from, to, passed, tier, onDone }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const stop = canvasRef.current ? runConfetti(canvasRef.current) : null;
    const t = setTimeout(() => onDone?.(), 4200);
    return () => { stop?.(); clearTimeout(t); };
  }, [onDone]);

  const tierName = tier ? tier[0].toUpperCase() + tier.slice(1) : null;
  return (
    <div
      onClick={onDone}
      style={{ position: "fixed", inset: 0, zIndex: 9999, pointerEvents: "auto", cursor: "pointer" }}
    >
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div style={{
        position: "absolute", top: "14%", left: "50%", transform: "translateX(-50%)",
        animation: "sc-rank-pop .55s cubic-bezier(.34,1.56,.64,1) both",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        padding: "22px 34px", borderRadius: 20,
        background: "rgba(15,18,26,0.92)",
        border: "1px solid rgba(245,166,35,0.45)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(245,166,35,0.18)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
      }}>
        <div style={{ fontSize: 44, lineHeight: 1, filter: "drop-shadow(0 4px 10px rgba(245,166,35,0.5))" }}>🏆</div>
        <div style={{
          fontSize: 22, fontWeight: 900, letterSpacing: "-0.02em",
          background: "linear-gradient(90deg,#FFD166,#F5A623,#FFD166)",
          backgroundSize: "200% 100%",
          WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent",
          animation: "sc-rank-shine 2.2s linear infinite",
        }}>
          You moved up!
        </div>
        <div style={{ color: "#e8eaf0", fontSize: 14, fontWeight: 600, textAlign: "center" }}>
          {passed > 0 ? (
            <>You passed <b style={{ color: "#FFD166" }}>{passed} scholar{passed !== 1 ? "s" : ""}</b> — </>
          ) : null}
          now <b style={{ color: "#FFD166" }}>#{to}</b>{tierName ? ` in ${tierName}` : ""}
        </div>
        <div style={{ fontSize: 11, color: "#9aa1b5", fontWeight: 500 }}>
          {from ? `#${from} → #${to}` : ""} · Keep studying to climb higher
        </div>
      </div>
    </div>
  );
}
