// WebAudio tone engine — ported from the Streak Survival prototype.
// Call setSoundEnabled() to honor the user's mute preference; all tones are no-ops when off.

let AC = null;
let soundOn = true;

export function setSoundEnabled(on) {
  soundOn = on;
}

function ac() {
  if (!soundOn) return null;
  if (!AC) {
    try {
      AC = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  if (AC && AC.state === 'suspended') AC.resume().catch(() => {});
  return AC;
}

function tone(freq, dur = 0.1, type = 'sine', vol = 0.14, delay = 0) {
  const ctx = ac();
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sound = {
  correct() {
    tone(660, 0.12, 'triangle', 0.13);
    tone(880, 0.16, 'triangle', 0.10, 0.07);
  },
  wrong() {
    tone(220, 0.25, 'sawtooth', 0.09);
    tone(160, 0.3, 'sawtooth', 0.07, 0.08);
  },
  heart() {
    tone(330, 0.15, 'sine', 0.1);
    tone(200, 0.2, 'sine', 0.08, 0.1);
  },
  milestone() {
    [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, i * 0.08));
  },
  perfect() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.11, i * 0.09));
  },
  click() {
    tone(900, 0.04, 'sine', 0.05);
  },
  levelup() {
    [392, 523, 659, 784].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, i * 0.1));
  },
  chest() {
    [440, 554, 659, 880, 1109].forEach((f, i) => tone(f, 0.16, 'triangle', 0.09, i * 0.07));
  },
  over() {
    [440, 392, 330, 262].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, i * 0.13));
  },
  heartbreak() {
    tone(392, 0.3, 'sawtooth', 0.10);
    tone(196, 0.5, 'sawtooth', 0.08, 0.18);
    tone(98, 0.8, 'sine', 0.12, 0.35);
  },
};
