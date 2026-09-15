// Lightweight WebAudio sound effects for the live quiz room.
let audioCtx = null;

function play(frequency, duration, type = "sine") {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = type;
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

export const sounds = {
  lock() { play(523.25, 0.1); setTimeout(() => play(659.25, 0.15), 100); },
  reveal() { play(440, 0.1, "triangle"); setTimeout(() => play(554, 0.2, "triangle"), 100); },
  tick() { play(1000, 0.05, "square"); },
  ready() { play(659.25, 0.1); setTimeout(() => play(783.99, 0.15), 100); },
  victory() { play(523.25, 0.15); setTimeout(() => play(659.25, 0.15), 150); setTimeout(() => play(783.99, 0.3), 300); },
  wager() { play(300, 0.1, "sawtooth"); setTimeout(() => play(450, 0.15, "sawtooth"), 100); },
  teach() { play(783.99, 0.15); setTimeout(() => play(1046.5, 0.2), 150); },
  pop() { play(880, 0.06, "sine"); },
};
