// Device-voice fallback (Web Speech API) for lessons whose hosted audio
// failed. Narration is spoken in sentence-sized chunks — required because
// Chrome on Android kills utterances longer than ~15s — and chunking gives
// pseudo-seek for the ±10s buttons. Pure-ish: engine state lives in the hook.

export const speechSupported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;

// Split narration into utterances of at most ~220 chars, breaking on sentence
// boundaries and merging short sentences. Hard-splits overlong sentences at
// the last space so no single utterance is huge.
export function chunkNarration(text) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+["')\]]*|[.!?]+$/g) || [clean];
  const chunks = [];
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    const last = chunks[chunks.length - 1];
    if (last && last.length + s.length + 1 <= 220) {
      chunks[chunks.length - 1] = `${last} ${s}`;
    } else {
      chunks.push(s);
    }
  }
  const out = [];
  for (const c of chunks) {
    let rest = c;
    while (rest.length > 220) {
      let cut = rest.lastIndexOf(" ", 220);
      if (cut < 80) cut = 220;
      out.push(rest.slice(0, cut).trim());
      rest = rest.slice(cut).trim();
    }
    if (rest) out.push(rest);
  }
  return out;
}

// Strip markdown into narration-friendly prose for the listen/podcast
// features: fences, headings, emphasis, links and list markers all become
// plain sentences before chunking.
export function mdToSpeechText(md) {
  return String(md || "")
    .replace(/```[\s\S]*?```/g, " ")          // code fences
    .replace(/`([^`]+)`/g, "$1")              // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")    // images
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")  // links → text
    .replace(/^#{1,6}\s+/gm, "")              // headings
    .replace(/^>\s?/gm, "")                   // blockquotes
    .replace(/^[\s]*[-*+]\s+/gm, "")          // bullets
    .replace(/^[\s]*\d+[.)]\s+/gm, "")        // numbered lists
    .replace(/\|/g, ", ")                     // table pipes read as pauses
    .replace(/^[-: |]+$/gm, " ")              // table separator rows
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1") // bold/italic/strike
    .replace(/<[^>]+>/g, " ")                 // html tags
    .replace(/\s+/g, " ")
    .trim();
}

let voicesPromise = null;

// Voice pick: an English voice, preferring on-device (localService) ones which
// keep working offline and don't burn data. Caches the list; getVoices() can
// return empty until voiceschanged fires (Chrome/Safari async loading).
export function pickVoice() {
  if (!speechSupported()) return Promise.resolve(null);
  if (!voicesPromise) {
    voicesPromise = new Promise((resolve) => {
      const grab = () => {
        const vs = window.speechSynthesis.getVoices();
        if (!vs.length) return null;
        const en = vs.filter((v) => /^en([-_]|$)/i.test(v.lang));
        const pick =
          en.find((v) => v.localService && /gb|uk/i.test(v.lang)) ||
          en.find((v) => v.localService) ||
          en.find((v) => /google/i.test(v.name)) ||
          en[0] ||
          vs.find((v) => v.default) ||
          vs[0];
        resolve(pick || null);
        return true;
      };
      if (!grab()) {
        const on = () => { if (grab()) window.speechSynthesis.removeEventListener("voiceschanged", on); };
        window.speechSynthesis.addEventListener("voiceschanged", on);
        setTimeout(() => { window.speechSynthesis.removeEventListener("voiceschanged", on); grab(); }, 1200);
      }
    });
  }
  return voicesPromise;
}

// Drives one narration's chunk queue. Pause = cancel + resume from the current
// chunk (SpeechSynthesis.pause is unreliable cross-platform). Callbacks:
// onChunk(idx, count) fires per utterance, onEnd() fires once at the last.
export class SpeechEngine {
  constructor() {
    this.chunks = [];
    this.idx = 0;
    this.rate = 1;
    this.voice = null;
    this.stopped = true;
    this.onChunk = null;
    this.onEnd = null;
  }

  async start(chunks, { startAt = 0, rate = 1, onChunk, onEnd } = {}) {
    this.cancel();
    this.chunks = chunks;
    this.idx = Math.max(0, Math.min(startAt, chunks.length - 1));
    this.rate = rate;
    this.onChunk = onChunk || null;
    this.onEnd = onEnd || null;
    this.stopped = false;
    if (!this.voice) this.voice = await pickVoice();
    if (this.stopped) return; // cancelled while voices loaded
    this._speak(this.idx);
  }

  _speak(i) {
    if (this.stopped || !speechSupported()) { this._finish(); return; }
    const text = this.chunks[i];
    if (text == null) { this._finish(); return; }
    this.idx = i;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = this.rate;
    if (this.voice) { u.voice = this.voice; u.lang = this.voice.lang; }
    u.onend = () => {
      if (this.stopped) return;
      if (i + 1 < this.chunks.length) this._speak(i + 1);
      else this._finish();
    };
    u.onerror = () => {
      if (this.stopped) return;
      if (i + 1 < this.chunks.length) this._speak(i + 1);
      else this._finish();
    };
    this._u = u;
    this.onChunk?.(i, this.chunks.length);
    window.speechSynthesis.cancel(); // clears anything queued before ours
    window.speechSynthesis.speak(u);
  }

  _finish() {
    if (this.stopped) return;
    this.stopped = true;
    this.onEnd?.();
  }

  pause() {
    this.stopped = true;
    window.speechSynthesis?.cancel();
  }

  resume() {
    if (!this.stopped || !this.chunks.length) return;
    this.stopped = false;
    this._speak(this.idx);
  }

  // Pseudo ±10s: hop a few chunks.
  skipBy(n) {
    if (!this.chunks.length) return;
    const wasStopped = this.stopped;
    this.idx = Math.max(0, Math.min(this.chunks.length - 1, this.idx + n));
    if (!wasStopped) this._speak(this.idx);
    else this.onChunk?.(this.idx, this.chunks.length);
  }

  seekTo(frac) {
    if (!this.chunks.length) return;
    this.idx = Math.max(0, Math.min(this.chunks.length - 1, Math.floor(frac * this.chunks.length)));
    if (this.stopped) this.onChunk?.(this.idx, this.chunks.length);
    else this._speak(this.idx);
  }

  setRate(rate) {
    this.rate = rate;
    if (!this.stopped) this._speak(this.idx); // restart current chunk at new rate
  }

  cancel() {
    this.stopped = true;
    if (speechSupported()) window.speechSynthesis.cancel();
  }
}
