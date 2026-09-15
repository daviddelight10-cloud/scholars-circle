import { useCallback, useEffect, useRef } from 'react';

const COLORS = ['#00E5FF', '#FFB627', '#FF5E7E', '#4ADE80', '#FF7A9E'];

// Canvas confetti — ported from the Streak Survival prototype.
// Returns { canvasRef, fire } — attach canvasRef to a <canvas className="confetti-canvas">.
export default function useConfetti() {
  const canvasRef = useRef(null);
  const partsRef = useRef([]);
  const runningRef = useRef(false);
  const rafRef = useRef(0);

  useEffect(() => () => {
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
  }, []);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !runningRef.current) return;
    const ctx = canvas.getContext('2d');
    const parts = partsRef.current;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.vy += 0.12;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      if (p.y > canvas.height + 20) {
        parts.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.62);
      ctx.restore();
    }
    if (parts.length === 0) {
      runningRef.current = false;
      return;
    }
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const fire = useCallback((n = 60) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const parts = partsRef.current;
    for (let i = 0; i < n; i++) {
      parts.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height * 0.3,
        vx: (Math.random() - 0.5) * 9,
        vy: -(Math.random() * 7 + 3),
        rot: Math.random() * 6,
        vr: (Math.random() - 0.5) * 0.3,
        s: Math.random() * 7 + 4,
        c: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
    if (!runningRef.current) {
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(loop);
    }
  }, [loop]);

  return { canvasRef, fire };
}
