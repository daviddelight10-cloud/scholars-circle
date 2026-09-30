// Lightweight WebAudio feedback for guided-study quick checks.
// Created lazily on first call — the answering tap counts as a user gesture,
// so the AudioContext is allowed to start on iOS/Android.
let audioCtx = null;

function tone(freq, dur, type = "sine", gain = 0.12, delay = 0) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime + delay;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch {}
}

export const studySounds = {
  correct() { tone(660, 0.12); tone(880, 0.18, "sine", 0.12, 0.09); },
  wrong()   { tone(185, 0.18, "sawtooth", 0.1); tone(140, 0.22, "sawtooth", 0.08, 0.09); },
};
