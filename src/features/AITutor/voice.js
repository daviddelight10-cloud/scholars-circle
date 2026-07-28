// Voice helpers with Nigerian accent preference

export const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const synth = typeof window !== "undefined" ? window.speechSynthesis : null;

const PREF_KEY = "sc_tutor_voice_pref";

export function getAvailableVoices() {
  if (!synth) return [];
  return synth.getVoices() || [];
}

// Score how "Nigerian-sounding" a voice is (higher = better)
function nigerianScore(v) {
  const lang = (v.lang || "").toLowerCase();
  const name = (v.name || "").toLowerCase();
  if (lang === "en-ng" || lang === "en_ng") return 100;
  if (name.includes("nigeria") || name.includes("abeo") || name.includes("ezinne")) return 90;
  if (lang === "en-za" || name.includes("south africa")) return 70;
  if (lang === "en-gb") return 60;
  if (lang === "en-in") return 50;
  if (lang.startsWith("en") && !lang.startsWith("en-us")) return 40;
  if (lang.startsWith("en")) return 20;
  return 0;
}

export function pickNigerianVoice(voices = getAvailableVoices()) {
  if (!voices.length) return null;
  let best = voices[0];
  let bestScore = -1;
  for (const v of voices) {
    const s = nigerianScore(v);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return best;
}

export function getPreferredVoice() {
  const voices = getAvailableVoices();
  if (!voices.length) return null;
  try {
    const saved = localStorage.getItem(PREF_KEY);
    if (saved) {
      const found = voices.find((v) => v.voiceURI === saved || v.name === saved);
      if (found) return found;
    }
  } catch {}
  return pickNigerianVoice(voices);
}

export function saveVoicePreference(voice) {
  if (!voice) {
    try {
      localStorage.removeItem(PREF_KEY);
    } catch {}
    return;
  }
  try {
    localStorage.setItem(PREF_KEY, voice.voiceURI || voice.name);
  } catch {}
}

// Get all English voices grouped for a picker UI, with Nigerian-sounding ones first
export function getEnglishVoicesSorted() {
  return getAvailableVoices()
    .filter((v) => (v.lang || "").toLowerCase().startsWith("en"))
    .sort((a, b) => nigerianScore(b) - nigerianScore(a));
}

export function speak(text, opts = {}) {
  if (!synth || !text) return null;
  synth.cancel();

  // Strip leftover markdown / formatting before TTS
  const cleaned = String(text)
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/[*_`#~]+/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.rate = opts.rate ?? 0.92;
  utterance.pitch = opts.pitch ?? 1.0;
  utterance.volume = opts.volume ?? 1.0;

  const voice = opts.voice || getPreferredVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  if (opts.onStart) utterance.onstart = opts.onStart;
  if (opts.onEnd) utterance.onend = opts.onEnd;
  if (opts.onError) utterance.onerror = opts.onError;

  synth.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  synth?.cancel();
}

export function whenVoicesReady() {
  return new Promise((resolve) => {
    if (!synth) return resolve([]);
    const list = synth.getVoices();
    if (list.length) return resolve(list);
    const handler = () => {
      resolve(synth.getVoices());
      synth.removeEventListener("voiceschanged", handler);
    };
    synth.addEventListener("voiceschanged", handler);
    setTimeout(() => resolve(synth.getVoices()), 1500);
  });
}
