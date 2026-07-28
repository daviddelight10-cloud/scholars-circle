import { useRef, useEffect } from "react";
import { COLORS, VOICE_STATES } from "./voiceConfig.js";

const STATE_COLORS = {
  [VOICE_STATES.IDLE]: COLORS.electric,
  [VOICE_STATES.CONNECTING]: COLORS.gold,
  [VOICE_STATES.READY]: COLORS.electric,
  [VOICE_STATES.LISTENING]: COLORS.green,
  [VOICE_STATES.SPEAKING]: COLORS.gold,
  [VOICE_STATES.THINKING]: COLORS.gold,
  [VOICE_STATES.ERROR]: COLORS.coral,
  [VOICE_STATES.ENDED]: COLORS.textDim,
};

export default function VoiceOrb({ state, micLevel = 0, onClick, size = 200, getAudioData = null }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const stateRef = useRef(state);
  const micRef = useRef(micLevel);
  const timeRef = useRef(0);
  const audioDataRef = useRef({ micData: null, tutorData: null });

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { micRef.current = micLevel; }, [micLevel]);
  useEffect(() => { audioDataRef.current.getAudioData = getAudioData; }, [getAudioData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const baseRadius = size * 0.28;

    function draw() {
      timeRef.current += 0.016;
      const t = timeRef.current;
      const s = stateRef.current;
      const ml = micRef.current;
      const color = STATE_COLORS[s] || COLORS.electric;

      let micFreq = null;
      let tutorFreq = null;
      if (audioDataRef.current.getAudioData) {
        const ad = audioDataRef.current.getAudioData();
        micFreq = ad.micData;
        tutorFreq = ad.tutorData;
      }

      ctx.clearRect(0, 0, size, size);

      if (s === VOICE_STATES.CONNECTING || s === VOICE_STATES.THINKING) {
        drawSpinner(ctx, cx, cy, baseRadius, t, color);
      } else if (s === VOICE_STATES.LISTENING) {
        const intensity = micFreq ? computeAvg(micFreq) / 255 : ml;
        drawRipples(ctx, cx, cy, baseRadius, t, intensity, color, micFreq);
        drawCore(ctx, cx, cy, baseRadius * (1 + intensity * 0.2), t, color);
      } else if (s === VOICE_STATES.SPEAKING) {
        drawWaveform(ctx, cx, cy, baseRadius, t, color, tutorFreq);
      } else if (s === VOICE_STATES.ERROR) {
        drawCore(ctx, cx, cy, baseRadius, t, color, 0.3);
      } else if (s === VOICE_STATES.ENDED) {
        drawCore(ctx, cx, cy, baseRadius * 0.7, t, color, 0.2);
      } else {
        drawIdlePulse(ctx, cx, cy, baseRadius, t, color, micFreq);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      style={{
        width: size,
        height: size,
        cursor: onClick ? "pointer" : "default",
        display: "block",
      }}
    />
  );
}

function drawIdlePulse(ctx, cx, cy, r, t, color, micFreq) {
  let pulse = Math.sin(t * 1.5) * 0.08 + 1;
  if (micFreq) {
    const avg = computeAvg(micFreq) / 255;
    pulse = 1 + avg * 0.12;
  }
  const glowR = r * 2.2;

  const grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, glowR);
  grad.addColorStop(0, hexToRgba(color, 0.15));
  grad.addColorStop(0.5, hexToRgba(color, 0.05));
  grad.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();

  drawCore(ctx, cx, cy, r * pulse, t, color, 0.8);
}

function drawCore(ctx, cx, cy, r, t, color, alpha = 1) {
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
  grad.addColorStop(0, hexToRgba(color, alpha));
  grad.addColorStop(0.7, hexToRgba(color, alpha * 0.6));
  grad.addColorStop(1, hexToRgba(color, alpha * 0.2));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = hexToRgba(color, alpha * 0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

function drawRipples(ctx, cx, cy, r, t, micLevel, color, micFreq) {
  const numRipples = micFreq ? 4 : 3;
  for (let i = 0; i < numRipples; i++) {
    const phase = (t * 0.8 + i * (1 / numRipples)) % 1;
    const rippleR = r + phase * r * 2.5;
    let alpha = (1 - phase) * 0.4 * (0.5 + micLevel);
    if (micFreq) {
      const freqIdx = Math.floor((i / numRipples) * micFreq.length);
      alpha *= 0.5 + (micFreq[freqIdx] / 255) * 0.5;
    }
    ctx.strokeStyle = hexToRgba(color, alpha);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, rippleR, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawWaveform(ctx, cx, cy, r, t, color, tutorFreq) {
  const bars = 24;
  const maxBar = r * 0.6;

  for (let i = 0; i < bars; i++) {
    const angle = (i / bars) * Math.PI * 2;
    let barH;
    if (tutorFreq && tutorFreq.length > 0) {
      const freqIdx = Math.floor((i / bars) * tutorFreq.length);
      const freqVal = tutorFreq[freqIdx] / 255;
      barH = (freqVal * 0.85 + 0.08) * maxBar;
    } else {
      const wave = Math.sin(t * 4 + i * 0.5) * 0.5 + Math.sin(t * 7 + i * 0.3) * 0.3;
      barH = (Math.abs(wave) + 0.1) * maxBar;
    }
    const innerR = r * 1.1;
    const outerR = innerR + barH;

    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * outerR;
    const y2 = cy + Math.sin(angle) * outerR;

    ctx.strokeStyle = hexToRgba(color, 0.7);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  drawCore(ctx, cx, cy, r * 0.9, t, color, 0.6);
}

function drawSpinner(ctx, cx, cy, r, t, color) {
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2 + t * 3;
    const opacity = ((i / segments) + t * 2) % 1;
    const segR = r * (0.8 + opacity * 0.4);
    const x = cx + Math.cos(angle) * segR;
    const y = cy + Math.sin(angle) * segR;
    ctx.fillStyle = hexToRgba(color, opacity * 0.8);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  drawCore(ctx, cx, cy, r * 0.7, t, color, 0.4);
}

function computeAvg(freqData) {
  if (!freqData || freqData.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < freqData.length; i++) {
    sum += freqData[i];
  }
  return sum / freqData.length;
}

function hexToRgba(hex, alpha) {
  if (hex.startsWith("rgba")) return hex;
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
